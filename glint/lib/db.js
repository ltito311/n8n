import fs from 'node:fs';
import path from 'node:path';

export function createDb(dir) {
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, 'db.json');
	let state = { videos: [] };
	if (fs.existsSync(file)) {
		try {
			state = JSON.parse(fs.readFileSync(file, 'utf8'));
		} catch {
			fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
		}
	}

	let timer = null;
	const flush = () => {
		const tmp = `${file}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
		fs.renameSync(tmp, file);
	};
	const save = () => {
		clearTimeout(timer);
		timer = setTimeout(flush, 50);
	};
	process.on('exit', () => {
		clearTimeout(timer);
		flush();
	});

	return {
		list: () => [...state.videos].sort((a, b) => b.createdAt - a.createdAt),
		get: (id) => state.videos.find((v) => v.id === id),
		insert(video) {
			state.videos.push(video);
			save();
			return video;
		},
		update(id, patch) {
			const v = state.videos.find((x) => x.id === id);
			if (!v) return null;
			Object.assign(v, typeof patch === 'function' ? patch(v) ?? {} : patch);
			v.updatedAt = Date.now();
			save();
			return v;
		},
		remove(id) {
			const i = state.videos.findIndex((v) => v.id === id);
			if (i === -1) return null;
			const [v] = state.videos.splice(i, 1);
			save();
			return v;
		},
	};
}
