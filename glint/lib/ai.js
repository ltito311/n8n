import fs from 'node:fs';
import { execFile } from 'node:child_process';

const env = (k, d = '') => (process.env[k] ?? '').trim() || d;
const GROQ_URL = () => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1');

export const aiConfig = () => ({
	enabled: Boolean(env('GROQ_API_KEY')),
	model: env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
	transcription: env('GROQ_TRANSCRIBE', 'on') !== 'off' && Boolean(env('GROQ_API_KEY')),
});

const fmt = (s) => {
	s = Math.max(0, Math.floor(s));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const transcriptText = (segments = [], withTimes = true) =>
	segments.map((s) => (withTimes ? `[${fmt(s.start)}] ${s.text}` : s.text)).join('\n');

async function chat(messages, { json = false, temperature = 0.3, maxTokens = 1500 } = {}) {
	const key = env('GROQ_API_KEY');
	if (!key) throw new Error('GROQ_API_KEY is not set');
	const res = await fetch(`${GROQ_URL()}/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
		body: JSON.stringify({
			model: aiConfig().model,
			messages,
			temperature,
			max_tokens: maxTokens,
			...(json ? { response_format: { type: 'json_object' } } : {}),
		}),
	});
	if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const data = await res.json();
	return data.choices?.[0]?.message?.content ?? '';
}

const parseJson = (raw) => {
	try {
		return JSON.parse(raw);
	} catch {
		const m = raw.match(/\{[\s\S]*\}/);
		if (m) return JSON.parse(m[0]);
		throw new Error('AI returned invalid JSON');
	}
};

export async function enrich(video) {
	const transcript = transcriptText(video.transcript);
	const prompt = `You are processing an async video message (a screen + camera recording).
Duration: ${fmt(video.duration || 0)}.
Transcript with timestamps:
"""
${transcript || '(no speech detected)'}
"""

Return a JSON object with exactly these keys:
- "title": a punchy, specific title (max 60 chars, no quotes, no emoji)
- "summary": 2-4 sentence summary written for someone who will not watch the video
- "chapters": array of {"t": seconds (number), "title": string (max 40 chars)} — 2-8 chapters, first at 0, only if the video is longer than 45s, otherwise []
- "actionItems": array of short imperative strings (may be empty)
- "tags": array of 1-4 lowercase topic tags`;
	const out = parseJson(
		await chat([
			{ role: 'system', content: 'You turn video transcripts into clean metadata. Reply with JSON only.' },
			{ role: 'user', content: prompt },
		], { json: true }),
	);
	return {
		title: String(out.title || '').slice(0, 80),
		summary: String(out.summary || ''),
		chapters: (Array.isArray(out.chapters) ? out.chapters : [])
			.map((c) => ({ t: Math.max(0, Number(c.t) || 0), title: String(c.title || '').slice(0, 60) }))
			.filter((c) => c.title && c.t <= (video.duration || Infinity))
			.sort((a, b) => a.t - b.t),
		actionItems: (Array.isArray(out.actionItems) ? out.actionItems : []).map(String),
		tags: (Array.isArray(out.tags) ? out.tags : []).map((t) => String(t).toLowerCase()).slice(0, 4),
	};
}

export async function ask(video, question, history = []) {
	return chat(
		[
			{
				role: 'system',
				content: `You answer questions about a recorded video using only its transcript. Cite timestamps like [1:23] when relevant. Be concise. If the transcript doesn't contain the answer, say so.\n\nTitle: ${video.title}\nTranscript:\n"""\n${transcriptText(video.transcript) || '(empty)'}\n"""`,
			},
			...history.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
			{ role: 'user', content: question },
		],
		{ temperature: 0.2, maxTokens: 700 },
	);
}

export async function draftMessage(video, kind, link) {
	const style =
		kind === 'email'
			? 'a short email (subject line first as "Subject: ...", then body)'
			: 'a short, friendly Slack/Teams message (1-3 lines, may use 1 emoji)';
	return chat(
		[
			{ role: 'system', content: 'You write messages that share a video recording with teammates. Output only the message.' },
			{
				role: 'user',
				content: `Write ${style} sharing this video. Include the link ${link} once. Mention what it covers and any asks.\n\nTitle: ${video.title}\nSummary: ${video.ai?.summary || ''}\nAction items: ${(video.ai?.actionItems || []).join('; ')}\nTranscript:\n${transcriptText(video.transcript, false).slice(0, 6000)}`,
			},
		],
		{ temperature: 0.6, maxTokens: 400 },
	);
}

// Pull a small mono audio track out of the video so uploads stay well under Groq's file limit.
const extractAudio = (filePath) =>
	new Promise((resolve) => {
		const out = filePath.replace(/\.\w+$/, '.audio.ogg');
		execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '24k', out], (err) =>
			resolve(err ? null : out),
		);
	});

export async function transcribeFile(filePath, mime) {
	const key = env('GROQ_API_KEY');
	if (!key) return null;
	const audio = await extractAudio(filePath);
	const form = new FormData();
	if (audio) form.append('file', new Blob([fs.readFileSync(audio)], { type: 'audio/ogg' }), 'audio.ogg');
	else form.append('file', new Blob([fs.readFileSync(filePath)], { type: mime || 'video/webm' }), `audio.${(mime || '').includes('mp4') ? 'mp4' : 'webm'}`);
	if (audio) fs.rmSync(audio, { force: true });
	form.append('model', env('GROQ_TRANSCRIBE_MODEL', 'whisper-large-v3-turbo'));
	form.append('response_format', 'verbose_json');
	const res = await fetch(`${GROQ_URL()}/audio/transcriptions`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${key}` },
		body: form,
	});
	if (!res.ok) throw new Error(`Transcription ${res.status}: ${(await res.text()).slice(0, 300)}`);
	const data = await res.json();
	if (Array.isArray(data.segments)) {
		return data.segments.map((s) => ({ start: s.start, end: s.end, text: String(s.text).trim() })).filter((s) => s.text);
	}
	return data.text ? [{ start: 0, end: 0, text: data.text.trim() }] : [];
}
