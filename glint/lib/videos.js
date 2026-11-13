// Event-sourced video records: videos/<id>/base.json + videos/<id>/e/<ts>-<rand>.json
import crypto from 'node:crypto';

const isEvent = (p) => p.includes('/e/');
const evTime = (p) => Number(p.split('/e/')[1].split('-')[0]) || 0;

function apply(v, ev) {
	switch (ev.type) {
		case 'patch':
			Object.assign(v, ev.patch);
			break;
		case 'ai':
			v.ai = ev.replace ? { ...ev.ai } : { ...v.ai, ...ev.ai };
			break;
		case 'comment':
			v.comments.push(ev.comment);
			break;
		case 'uncomment':
			v.comments = v.comments.filter((c) => c.id !== ev.id);
			break;
		case 'reaction':
			v.reactions.push(ev.reaction);
			break;
		case 'view':
			v.views += 1;
			break;
	}
	v.updatedAt = Math.max(v.updatedAt || 0, ev.at || 0);
}

function fold(items) {
	const base = items.find((i) => !isEvent(i.pathname));
	if (!base) return null;
	const v = { views: 0, comments: [], reactions: [], ai: {}, ...structuredClone(base.data) };
	items
		.filter((i) => isEvent(i.pathname))
		.sort((a, b) => evTime(a.pathname) - evTime(b.pathname) || a.pathname.localeCompare(b.pathname))
		.forEach((i) => apply(v, i.data));
	return v;
}

export function createVideos(storage) {
	return {
		async list() {
			const groups = new Map();
			for (const it of await storage.listJson('videos/')) {
				const id = it.pathname.split('/')[1];
				if (!groups.has(id)) groups.set(id, []);
				groups.get(id).push(it);
			}
			return [...groups.values()].map(fold).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
		},
		async get(id) {
			if (!/^[\w-]{4,40}$/.test(id)) return null;
			return fold(await storage.listJson(`videos/${id}/`));
		},
		async create(video) {
			await storage.putJson(`videos/${video.id}/base.json`, video);
			return video;
		},
		async event(id, ev) {
			const at = Date.now();
			const key = `videos/${id}/e/${String(at).padStart(14, '0')}-${crypto.randomBytes(4).toString('hex')}.json`;
			await storage.putJson(key, { ...ev, at });
		},
		async remove(id) {
			await storage.removePrefix(`videos/${id}/`);
		},
	};
}
