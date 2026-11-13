// Tiny key/value layer. Every write is a new immutable JSON object, so it works the same
// on local disk and on Vercel Blob (where overwritten objects can be served stale from cache).
import fs from 'node:fs';
import path from 'node:path';

export const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function createStorage(dataDir) {
	return useBlob() ? blobStorage() : fsStorage(path.join(dataDir, 'kv'));
}

function fsStorage(dir) {
	const walk = (d) =>
		fs.existsSync(d)
			? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
			: [];
	return {
		async putJson(key, obj) {
			const f = path.join(dir, key);
			fs.mkdirSync(path.dirname(f), { recursive: true });
			fs.writeFileSync(f, JSON.stringify(obj));
		},
		async listJson(prefix) {
			return walk(path.join(dir, prefix)).map((f) => ({
				pathname: path.relative(dir, f).split(path.sep).join('/'),
				data: JSON.parse(fs.readFileSync(f, 'utf8')),
			}));
		},
		async removePrefix(prefix) {
			fs.rmSync(path.join(dir, prefix), { recursive: true, force: true });
		},
	};
}

function blobStorage() {
	let sdk;
	const blob = async () => (sdk ??= await import('@vercel/blob'));
	const listAll = async (prefix) => {
		const { list } = await blob();
		const out = [];
		let cursor;
		do {
			const r = await list({ prefix, cursor, limit: 1000 });
			out.push(...r.blobs);
			cursor = r.hasMore ? r.cursor : undefined;
		} while (cursor);
		return out;
	};
	return {
		async putJson(key, obj) {
			const { put } = await blob();
			await put(key, JSON.stringify(obj), { access: 'public', contentType: 'application/json', addRandomSuffix: true });
		},
		async listJson(prefix) {
			const items = await listAll(prefix);
			return Promise.all(
				items.map(async (b) => ({ pathname: b.pathname, data: await (await fetch(b.url)).json() })),
			);
		},
		async removePrefix(prefix) {
			const { del } = await blob();
			const items = await listAll(prefix);
			for (let i = 0; i < items.length; i += 500) await del(items.slice(i, i + 500).map((b) => b.url));
		},
	};
}

export async function deleteMedia(urls, mediaDir) {
	const remote = urls.filter((u) => u && /^https?:/.test(u));
	const local = urls.filter((u) => u && u.startsWith('/media/'));
	for (const u of local) fs.rmSync(path.join(mediaDir, path.basename(u)), { force: true });
	if (remote.length && useBlob()) {
		const { del } = await import('@vercel/blob');
		await del(remote);
	}
}
