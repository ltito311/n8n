import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStorage, deleteMedia, useBlob } from './lib/storage.js';
import { createVideos } from './lib/videos.js';
import { aiConfig, enrich, ask, draftMessage, transcribe, extractAudio } from './lib/ai.js';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.join(root, 'data');
export const mediaDir = path.join(dataDir, 'media');
const onVercel = Boolean(process.env.VERCEL);
if (!useBlob()) fs.mkdirSync(mediaDir, { recursive: true });

const videos = createVideos(createStorage(dataDir));
export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const newId = () => crypto.randomBytes(6).toString('base64url');
const BUSY = ['queued', 'processing', 'transcribing'];

// ---------- background work ----------
let waitUntilFn = null;
const bg = (p) => {
	const run = p.catch((e) => console.error('[bg]', e));
	if (onVercel) {
		(waitUntilFn
			? Promise.resolve(waitUntilFn)
			: import('@vercel/functions').then((m) => (waitUntilFn = m.waitUntil))
		).then((w) => w(run));
	}
};

let hasFfmpeg = false;
if (!onVercel) execFile('ffmpeg', ['-version'], (err) => (hasFfmpeg = !err));

const remux = (file) =>
	new Promise((resolve) => {
		if (!hasFfmpeg || !file.endsWith('.webm')) return resolve(false);
		const tmp = file.replace(/\.webm$/, '.fixed.webm');
		execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-c', 'copy', tmp], (err) => {
			if (err) {
				fs.rmSync(tmp, { force: true });
				return resolve(false);
			}
			fs.renameSync(tmp, file);
			resolve(true);
		});
	});

async function readMedia(url) {
	if (!url) return null;
	if (url.startsWith('/media/')) return fs.readFileSync(path.join(mediaDir, path.basename(url)));
	const r = await fetch(url);
	if (!r.ok) throw new Error(`fetch media ${r.status}`);
	return Buffer.from(await r.arrayBuffer());
}

async function audioSource(v) {
	if (v.audioUrl) return { buf: await readMedia(v.audioUrl), type: v.audioMime || 'audio/webm' };
	if (v.videoUrl?.startsWith('/media/') && hasFfmpeg) {
		const buf = await extractAudio(path.join(mediaDir, path.basename(v.videoUrl)));
		if (buf) return { buf, type: 'audio/ogg' };
	}
	if ((v.size || 0) < 24e6) return { buf: await readMedia(v.videoUrl), type: v.mime };
	return null;
}

const words = (a = []) => a.map((x) => x.text).join(' ').split(/\s+/).filter(Boolean).length;

async function processVideo(id) {
	let v = await videos.get(id);
	if (!v) return;
	const cfg = aiConfig();
	try {
		if (cfg.transcription && v.transcriptSource !== 'whisper') {
			await videos.event(id, { type: 'ai', ai: { status: 'transcribing', error: null } });
			try {
				const segs = await transcribe(await audioSource(v));
				// Keep the live-caption transcript if Whisper heard far less (likely silence/noise).
				if (segs?.length && words(segs) >= words(v.transcript) * 0.5) {
					await videos.event(id, { type: 'patch', patch: { transcript: segs, transcriptSource: 'whisper' } });
				}
			} catch (e) {
				console.error('[transcribe]', e.message, '— keeping browser transcript');
			}
			v = await videos.get(id);
		}
		if (!cfg.enabled) return videos.event(id, { type: 'ai', ai: { status: 'disabled' } });
		if (!v.transcript?.length) return videos.event(id, { type: 'ai', replace: true, ai: { status: 'nospeech' } });
		await videos.event(id, { type: 'ai', ai: { status: 'processing', error: null } });
		const out = await enrich(v);
		if (!v.titleLocked && out.title) await videos.event(id, { type: 'patch', patch: { title: out.title } });
		await videos.event(id, { type: 'ai', ai: { ...out, status: 'done', error: null, at: Date.now() } });
	} catch (e) {
		console.error('[ai]', e.message);
		await videos.event(id, { type: 'ai', ai: { status: 'error', error: e.message } });
	}
}

// ---------- auth (optional: set APP_PASSWORD) ----------
const PASS = () => process.env.APP_PASSWORD || '';
const ownerToken = () => crypto.createHmac('sha256', PASS()).update('glint-owner-v1').digest('base64url');
const cookies = (req) =>
	Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((p) => p[0]));
const isOwner = (req) => !PASS() || cookies(req).glint_auth === ownerToken();
const owner = (req, res, next) => (isOwner(req) ? next() : res.status(401).json({ error: 'Login required' }));
const safeEq = (a, b) => {
	const x = crypto.createHash('sha256').update(String(a)).digest();
	const y = crypto.createHash('sha256').update(String(b)).digest();
	return crypto.timingSafeEqual(x, y);
};

app.post('/api/login', (req, res) => {
	if (!PASS() || !safeEq(req.body?.password || '', PASS())) return res.status(401).json({ error: 'Wrong password' });
	res.setHeader(
		'Set-Cookie',
		`glint_auth=${ownerToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${onVercel ? '; Secure' : ''}`,
	);
	res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
	res.setHeader('Set-Cookie', 'glint_auth=; Path=/; Max-Age=0');
	res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ owner: isOwner(req), locked: Boolean(PASS()) }));

app.get('/api/config', (req, res) => {
	const c = aiConfig();
	res.json({ ai: c.enabled, model: c.model, transcription: c.transcription, storage: useBlob() ? 'blob' : 'local' });
});

// ---------- uploads ----------
// Vercel Blob: the browser uploads straight to storage; this hands out short-lived tokens.
app.post('/api/upload', owner, async (req, res) => {
	try {
		const { handleUpload } = await import('@vercel/blob/client');
		const out = await handleUpload({
			body: req.body,
			request: req,
			onBeforeGenerateToken: async () => ({
				allowedContentTypes: ['video/*', 'audio/*', 'image/jpeg', 'image/png'],
				maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
				addRandomSuffix: true,
			}),
		});
		res.json(out);
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
});

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, mediaDir),
		filename: (req, file, cb) => {
			req.vid ??= newId();
			const ext = file.fieldname === 'thumb' ? 'jpg' : file.mimetype.includes('mp4') ? (file.fieldname === 'audio' ? 'm4a' : 'mp4') : 'webm';
			cb(null, `${req.vid}${file.fieldname === 'audio' ? '.audio' : ''}.${ext}`);
		},
	}),
	limits: { fileSize: 4 * 1024 * 1024 * 1024 },
});
const maybeMultipart = (req, res, next) =>
	req.is('multipart/form-data')
		? upload.fields([
				{ name: 'video', maxCount: 1 },
				{ name: 'thumb', maxCount: 1 },
				{ name: 'audio', maxCount: 1 },
			])(req, res, next)
		: next();

const blobUrl = (u) => (typeof u === 'string' && /^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(u) ? u : null);

app.post('/api/videos', owner, maybeMultipart, async (req, res) => {
	let meta = {};
	let media;
	if (req.files) {
		const f = req.files.video?.[0];
		if (!f) return res.status(400).json({ error: 'video file missing' });
		try {
			meta = JSON.parse(req.body.meta || '{}');
		} catch {}
		media = {
			id: req.vid,
			videoUrl: `/media/${f.filename}`,
			thumbUrl: req.files.thumb?.[0] ? `/media/${req.files.thumb[0].filename}` : null,
			audioUrl: req.files.audio?.[0] ? `/media/${req.files.audio[0].filename}` : null,
			audioMime: req.files.audio?.[0]?.mimetype || null,
			mime: f.mimetype,
			size: f.size,
		};
		await remux(path.join(mediaDir, f.filename));
	} else {
		const b = req.body || {};
		if (!blobUrl(b.videoUrl)) return res.status(400).json({ error: 'videoUrl missing' });
		meta = b.meta || {};
		media = {
			id: newId(),
			videoUrl: b.videoUrl,
			thumbUrl: blobUrl(b.thumbUrl),
			audioUrl: blobUrl(b.audioUrl),
			audioMime: b.audioMime || null,
			mime: String(b.mime || 'video/webm'),
			size: Number(b.size) || 0,
		};
	}
	const now = Date.now();
	const transcript = Array.isArray(meta.transcript) ? meta.transcript.slice(0, 5000) : [];
	const video = await videos.create({
		...media,
		title: String(meta.title || `Recording ${new Date(now).toLocaleString('en-US')}`).slice(0, 120),
		titleLocked: false,
		description: '',
		duration: Number(meta.duration) || 0,
		width: Number(meta.width) || 0,
		height: Number(meta.height) || 0,
		mode: meta.mode || 'screen-cam',
		trim: { start: 0, end: null },
		transcript,
		transcriptSource: transcript.length ? 'browser' : null,
		ai: { status: 'queued' },
		createdAt: now,
		updatedAt: now,
	});
	bg(processVideo(video.id));
	res.status(201).json(video);
});

// ---------- read ----------
const pub = (v) => v && { ...v, url: v.videoUrl };

app.get('/api/videos', owner, async (req, res) => {
	const q = String(req.query.q || '').toLowerCase().trim();
	let list = await videos.list();
	if (q) {
		list = list.filter((v) =>
			[v.title, v.ai?.summary, ...(v.ai?.tags || []), ...(v.transcript || []).map((s) => s.text)].join(' ').toLowerCase().includes(q),
		);
	}
	res.json(
		list.map((v) => {
			const { transcript, comments, reactions, ...rest } = pub(v);
			return { ...rest, commentCount: comments?.length || 0, reactionCount: reactions?.length || 0 };
		}),
	);
});

const load = async (req, res) => {
	const v = await videos.get(req.params.id);
	if (!v) res.status(404).json({ error: 'not found' });
	return v;
};

app.get('/api/videos/:id', async (req, res) => {
	const v = await load(req, res);
	if (v) res.json(pub(v));
});

// ---------- owner edits ----------
app.patch('/api/videos/:id', owner, async (req, res) => {
	if (!(await load(req, res))) return;
	const b = req.body || {};
	const patch = {};
	if (typeof b.title === 'string') Object.assign(patch, { title: b.title.slice(0, 120), titleLocked: true });
	if (typeof b.description === 'string') patch.description = b.description.slice(0, 5000);
	if (b.trim) patch.trim = { start: Math.max(0, Number(b.trim.start) || 0), end: b.trim.end == null ? null : Number(b.trim.end) };
	await videos.event(req.params.id, { type: 'patch', patch });
	res.json(pub(await videos.get(req.params.id)));
});

app.delete('/api/videos/:id', owner, async (req, res) => {
	const v = await load(req, res);
	if (!v) return;
	await deleteMedia([v.videoUrl, v.thumbUrl, v.audioUrl], mediaDir).catch((e) => console.error('[delete]', e.message));
	await videos.remove(v.id);
	res.json({ ok: true });
});

app.post('/api/videos/:id/ai', owner, async (req, res) => {
	if (!(await load(req, res))) return;
	if (req.body?.resetTitle) await videos.event(req.params.id, { type: 'patch', patch: { titleLocked: false } });
	await videos.event(req.params.id, { type: 'ai', ai: { status: 'queued', error: null } });
	bg(processVideo(req.params.id));
	res.json({ ok: true });
});

app.post('/api/videos/:id/message', owner, async (req, res) => {
	const v = await load(req, res);
	if (!v) return;
	const base = process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
	try {
		res.json({ text: await draftMessage(v, req.body?.kind === 'email' ? 'email' : 'chat', `${base}/v/${v.id}`) });
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
});

app.delete('/api/videos/:id/comments/:cid', owner, async (req, res) => {
	await videos.event(req.params.id, { type: 'uncomment', id: req.params.cid });
	res.json({ ok: true });
});

// ---------- viewer interactions ----------
app.post('/api/videos/:id/view', async (req, res) => {
	const v = await load(req, res);
	if (!v) return;
	await videos.event(v.id, { type: 'view' });
	res.json({ views: (v.views || 0) + 1 });
});

app.post('/api/videos/:id/comments', async (req, res) => {
	if (!(await load(req, res))) return;
	const text = String(req.body?.text || '').trim().slice(0, 2000);
	if (!text) return res.status(400).json({ error: 'empty comment' });
	const c = {
		id: newId(),
		author: String(req.body?.author || 'Anonymous').slice(0, 40),
		text,
		t: req.body?.t == null ? null : Number(req.body.t),
		at: Date.now(),
	};
	await videos.event(req.params.id, { type: 'comment', comment: c });
	res.status(201).json(c);
});

app.post('/api/videos/:id/reactions', async (req, res) => {
	if (!(await load(req, res))) return;
	const r = { emoji: String(req.body?.emoji || '👍').slice(0, 8), t: Number(req.body?.t) || 0, at: Date.now() };
	await videos.event(req.params.id, { type: 'reaction', reaction: r });
	res.status(201).json(r);
});

app.post('/api/videos/:id/ask', async (req, res) => {
	const v = await load(req, res);
	if (!v) return;
	try {
		res.json({ answer: await ask(v, String(req.body?.question || '').slice(0, 1000), req.body?.history || []) });
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));
app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).json({ error: err.message || 'server error' });
});

export default app;
