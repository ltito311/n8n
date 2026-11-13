import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDb } from './lib/db.js';
import { aiConfig, enrich, ask, draftMessage, transcribeFile } from './lib/ai.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const mediaDir = path.join(dataDir, 'media');
fs.mkdirSync(mediaDir, { recursive: true });

const db = createDb(dataDir);
const app = express();
const PORT = Number(process.env.PORT) || 4747;

app.use(express.json({ limit: '2mb' }));

const id = () => crypto.randomBytes(6).toString('base64url');
const extFor = (mime = '') => (mime.includes('mp4') ? 'mp4' : 'webm');

const upload = multer({
	storage: multer.diskStorage({
		destination: mediaDir,
		filename: (req, file, cb) => {
			req.vid ??= id();
			cb(null, file.fieldname === 'thumb' ? `${req.vid}.jpg` : `${req.vid}.${extFor(file.mimetype)}`);
		},
	}),
	limits: { fileSize: 4 * 1024 * 1024 * 1024 },
});

let hasFfmpeg = false;
execFile('ffmpeg', ['-version'], (err) => (hasFfmpeg = !err));

// Remux MediaRecorder output so it has proper duration + seek cues.
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

const publicVideo = (v) => v && { ...v, url: `/media/${v.file}`, thumbUrl: v.thumb ? `/media/${v.thumb}` : null };

async function process_(vid) {
	let v = db.get(vid);
	if (!v) return;
	const cfg = aiConfig();
	try {
		if (cfg.transcription && v.transcriptSource !== 'whisper') {
			db.update(vid, { ai: { ...v.ai, status: 'transcribing' } });
			try {
				const segs = await transcribeFile(path.join(mediaDir, v.file), v.mime);
				if (segs?.length) db.update(vid, { transcript: segs, transcriptSource: 'whisper' });
			} catch (e) {
				console.error('[transcribe]', e.message, '— keeping browser transcript');
			}
		}
		v = db.get(vid);
		if (!cfg.enabled) return db.update(vid, { ai: { ...v.ai, status: 'disabled' } });
		if (!v.transcript?.length) return db.update(vid, { ai: { status: 'nospeech' } });
		db.update(vid, { ai: { ...v.ai, status: 'processing', error: null } });
		const out = await enrich(v);
		db.update(vid, (cur) => ({
			title: cur.titleLocked ? cur.title : out.title || cur.title,
			ai: { ...cur.ai, ...out, status: 'done', error: null, at: Date.now() },
		}));
	} catch (e) {
		console.error('[ai]', e.message);
		db.update(vid, (cur) => ({ ai: { ...cur.ai, status: 'error', error: e.message } }));
	}
}

// ---------- API ----------
app.get('/api/config', (req, res) => {
	const c = aiConfig();
	res.json({ ai: c.enabled, model: c.model, transcription: c.transcription, ffmpeg: hasFfmpeg });
});

app.get('/api/videos', (req, res) => {
	const q = String(req.query.q || '').toLowerCase().trim();
	let list = db.list();
	if (q) {
		list = list.filter((v) =>
			[v.title, v.ai?.summary, ...(v.ai?.tags || []), ...(v.transcript || []).map((s) => s.text)]
				.join(' ')
				.toLowerCase()
				.includes(q),
		);
	}
	res.json(
		list.map((v) => {
			const { transcript, comments, reactions, ...rest } = publicVideo(v);
			return { ...rest, commentCount: comments?.length || 0, reactionCount: reactions?.length || 0 };
		}),
	);
});

app.post(
	'/api/videos',
	upload.fields([
		{ name: 'video', maxCount: 1 },
		{ name: 'thumb', maxCount: 1 },
	]),
	async (req, res) => {
		const file = req.files?.video?.[0];
		if (!file) return res.status(400).json({ error: 'video file missing' });
		let meta = {};
		try {
			meta = JSON.parse(req.body.meta || '{}');
		} catch {}
		const now = Date.now();
		const video = db.insert({
			id: req.vid,
			title: String(meta.title || `Recording ${new Date(now).toLocaleString()}`).slice(0, 120),
			titleLocked: false,
			description: '',
			file: file.filename,
			thumb: req.files?.thumb?.[0]?.filename || null,
			mime: file.mimetype,
			size: file.size,
			duration: Number(meta.duration) || 0,
			width: Number(meta.width) || 0,
			height: Number(meta.height) || 0,
			mode: meta.mode || 'screen-cam',
			trim: { start: 0, end: null },
			transcript: Array.isArray(meta.transcript) ? meta.transcript : [],
			transcriptSource: Array.isArray(meta.transcript) && meta.transcript.length ? 'browser' : null,
			ai: { status: 'queued' },
			views: 0,
			comments: [],
			reactions: [],
			createdAt: now,
			updatedAt: now,
		});
		res.status(201).json(publicVideo(video));
		await remux(path.join(mediaDir, file.filename));
		process_(video.id);
	},
);

app.get('/api/videos/:id', (req, res) => {
	const v = db.get(req.params.id);
	if (!v) return res.status(404).json({ error: 'not found' });
	res.json(publicVideo(v));
});

app.patch('/api/videos/:id', (req, res) => {
	const b = req.body || {};
	const patch = {};
	if (typeof b.title === 'string') Object.assign(patch, { title: b.title.slice(0, 120), titleLocked: true });
	if (typeof b.description === 'string') patch.description = b.description.slice(0, 5000);
	if (b.trim) patch.trim = { start: Math.max(0, Number(b.trim.start) || 0), end: b.trim.end == null ? null : Number(b.trim.end) };
	if (Array.isArray(b.transcript)) patch.transcript = b.transcript;
	const v = db.update(req.params.id, patch);
	if (!v) return res.status(404).json({ error: 'not found' });
	res.json(publicVideo(v));
});

app.delete('/api/videos/:id', (req, res) => {
	const v = db.remove(req.params.id);
	if (!v) return res.status(404).json({ error: 'not found' });
	for (const f of [v.file, v.thumb]) if (f) fs.rmSync(path.join(mediaDir, f), { force: true });
	res.json({ ok: true });
});

app.post('/api/videos/:id/view', (req, res) => {
	const v = db.update(req.params.id, (cur) => ({ views: (cur.views || 0) + 1 }));
	res.json({ views: v?.views ?? 0 });
});

app.post('/api/videos/:id/comments', (req, res) => {
	const text = String(req.body?.text || '').trim().slice(0, 2000);
	if (!text) return res.status(400).json({ error: 'empty comment' });
	const c = {
		id: id(),
		author: String(req.body?.author || 'Anonymous').slice(0, 40),
		text,
		t: req.body?.t == null ? null : Number(req.body.t),
		at: Date.now(),
	};
	const v = db.update(req.params.id, (cur) => ({ comments: [...(cur.comments || []), c] }));
	if (!v) return res.status(404).json({ error: 'not found' });
	res.status(201).json(c);
});

app.delete('/api/videos/:id/comments/:cid', (req, res) => {
	const v = db.update(req.params.id, (cur) => ({ comments: (cur.comments || []).filter((c) => c.id !== req.params.cid) }));
	res.json({ ok: Boolean(v) });
});

app.post('/api/videos/:id/reactions', (req, res) => {
	const r = { emoji: String(req.body?.emoji || '👍').slice(0, 8), t: Number(req.body?.t) || 0, at: Date.now() };
	const v = db.update(req.params.id, (cur) => ({ reactions: [...(cur.reactions || []), r] }));
	if (!v) return res.status(404).json({ error: 'not found' });
	res.status(201).json(r);
});

app.post('/api/videos/:id/ai', (req, res) => {
	const v = db.get(req.params.id);
	if (!v) return res.status(404).json({ error: 'not found' });
	if (req.body?.resetTitle) db.update(v.id, { titleLocked: false });
	db.update(v.id, { ai: { ...v.ai, status: 'queued' } });
	process_(v.id);
	res.json({ ok: true });
});

app.post('/api/videos/:id/ask', async (req, res) => {
	const v = db.get(req.params.id);
	if (!v) return res.status(404).json({ error: 'not found' });
	try {
		res.json({ answer: await ask(v, String(req.body?.question || ''), req.body?.history || []) });
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
});

app.post('/api/videos/:id/message', async (req, res) => {
	const v = db.get(req.params.id);
	if (!v) return res.status(404).json({ error: 'not found' });
	const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
	try {
		res.json({ text: await draftMessage(v, req.body?.kind === 'email' ? 'email' : 'chat', `${base}/v/${v.id}`) });
	} catch (e) {
		res.status(502).json({ error: e.message });
	}
});

// ---------- Pages ----------
app.use('/media', express.static(mediaDir, { maxAge: '1h' }));
app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));
app.get('/v/:id', (req, res) => res.sendFile(path.join(root, 'public', 'watch.html')));

app.listen(PORT, () => {
	const c = aiConfig();
	console.log(`\n  ● Glint running at http://localhost:${PORT}`);
	console.log(`    AI: ${c.enabled ? `Groq (${c.model})` : 'off — set GROQ_API_KEY in .env'}`);
	console.log(`    Transcription: ${c.transcription ? 'Groq Whisper' : 'browser live captions'}\n`);
});
