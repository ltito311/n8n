import { $, $$, api, fmt, ago, esc, icons, toast, topbar, store, avatar, bytes } from './common.js';

const vid = location.pathname.split('/').pop();
$('#top').innerHTML = topbar(`<a class="btn btn-ghost" href="/">Library</a><a class="btn btn-primary" href="/record">${icons.plus} New</a>`);

const video = $('#video');
const player = $('#player');
let V = null;
let cfg = {};
let captionsOn = store.get('cc', false);
let txFilter = '';
const askHistory = [];

// ---------- static UI ----------
$('#bigPlay span').innerHTML = icons.play;
$('#backBtn').innerHTML = icons.back10;
$('#fwdBtn').innerHTML = icons.fwd10;
$('#ccBtn').innerHTML = icons.cc;
$('#pipBtn').innerHTML = icons.pip;
$('#fsBtn').innerHTML = icons.full;
$('#copyBtn').innerHTML = `${icons.link} Copy link`;
$('#msgBtn').innerHTML = `${icons.sparkle} Draft message`;
$('#trimBtn').innerHTML = `${icons.scissors} Trim`;
$('#dlBtn').innerHTML = `${icons.download} Download`;
$('#regenBtn').innerHTML = `${icons.refresh} Re-run AI`;
$('#delBtn').innerHTML = icons.trash;
$('#msgRegen').innerHTML = `${icons.refresh} Rewrite`;
$('#askSend').innerHTML = icons.send;
$('#reacts').innerHTML = ['👍', '❤️', '😂', '🔥', '🎉', '👀', '🤔'].map((e) => `<button data-e="${e}">${e}</button>`).join('');
const tabNames = { summary: [icons.sparkle, 'Summary'], transcript: [icons.text, 'Transcript'], comments: [icons.chat, 'Comments'], ask: [icons.sparkle, 'Ask AI'] };
const renderTabs = () =>
	$$('#tabs button').forEach((b) => {
		const t = b.dataset.tab;
		const count = t === 'comments' ? V?.comments?.length : t === 'transcript' ? V?.transcript?.length : 0;
		b.innerHTML = `${tabNames[t][1]}${count ? ` <span class="count">${count}</span>` : ''}`;
	});
$('#tabs').addEventListener('click', (e) => {
	const b = e.target.closest('[data-tab]');
	if (!b) return;
	$$('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
	$$('.tabpane').forEach((p) => p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
	if (b.dataset.tab === 'ask') $('#askText').focus();
});

// ---------- trim-aware helpers ----------
const realDur = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : V?.duration || 0);
const tStart = () => V?.trim?.start || 0;
const tEnd = () => (V?.trim?.end != null ? Math.min(V.trim.end, realDur()) : realDur());
const seek = (t, play = false) => {
	video.currentTime = Math.min(Math.max(t, tStart()), Math.max(tStart(), tEnd() - 0.05));
	if (play) video.play();
};
const tsLink = (t) => `<span class="tlink" data-t="${t}">${fmt(t)}</span>`;
const linkify = (text) => esc(text).replace(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g, (m, a, b, c) => {
	const t = c ? +a * 3600 + +b * 60 + +c : +a * 60 + +b;
	return `<span class="tlink" data-t="${t}">${m.slice(1, -1)}</span>`;
});
document.addEventListener('click', (e) => {
	const l = e.target.closest('[data-t]');
	if (l && !l.closest('#scrub')) seek(Number(l.dataset.t), true);
});

// ---------- player ----------
const setPlayIcon = () => {
	$('#playBtn').innerHTML = video.paused ? icons.play : icons.pause;
	player.classList.toggle('playing', !video.paused);
};
const toggle = () => (video.paused ? (video.currentTime >= tEnd() - 0.1 && seek(tStart()), video.play()) : video.pause());
$('#bigPlay').addEventListener('click', toggle);
$('#playBtn').addEventListener('click', toggle);
video.addEventListener('click', toggle);
video.addEventListener('play', setPlayIcon);
video.addEventListener('pause', setPlayIcon);
$('#backBtn').addEventListener('click', () => seek(video.currentTime - 5));
$('#fwdBtn').addEventListener('click', () => seek(video.currentTime + 5));

let viewed = false;
video.addEventListener('play', () => {
	if (!viewed) {
		viewed = true;
		api(`/videos/${vid}/view`, { method: 'POST' }).then((r) => {
			V.views = r.views;
			renderMeta();
		});
	}
});

const setVol = () => {
	$('#muteBtn').innerHTML = video.muted || video.volume === 0 ? icons.mute : icons.vol;
	$('#vol').value = video.muted ? 0 : video.volume;
};
$('#muteBtn').addEventListener('click', () => {
	video.muted = !video.muted;
	setVol();
});
$('#vol').addEventListener('input', (e) => {
	video.volume = Number(e.target.value);
	video.muted = video.volume === 0;
	store.set('vol', video.volume);
	setVol();
});
video.volume = store.get('vol', 1);
setVol();

const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5];
const setSpeed = (s) => {
	video.playbackRate = s;
	store.set('speed', s);
	$('#speedBtn').textContent = `${s}×`;
	$('#speedPop').innerHTML = speeds.map((x) => `<button data-s="${x}" class="${x === s ? 'on' : ''}">${x}×</button>`).join('');
};
setSpeed(store.get('speed', 1));
$('#speedBtn').addEventListener('click', () => $('#speedMenu').classList.toggle('open'));
$('#speedPop').addEventListener('click', (e) => {
	const b = e.target.closest('[data-s]');
	if (b) setSpeed(Number(b.dataset.s));
	$('#speedMenu').classList.remove('open');
});
document.addEventListener('click', (e) => !e.target.closest('#speedMenu') && $('#speedMenu').classList.remove('open'));

$('#fsBtn').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen()));
$('#pipBtn').addEventListener('click', () => (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture?.()));
$('#ccBtn').addEventListener('click', () => {
	captionsOn = !captionsOn;
	store.set('cc', captionsOn);
	$('#ccBtn').style.color = captionsOn ? 'var(--a2)' : '';
	onTime();
});
$('#ccBtn').style.color = captionsOn ? 'var(--a2)' : '';

let idleT;
player.addEventListener('mousemove', () => {
	player.classList.remove('idle');
	clearTimeout(idleT);
	idleT = setTimeout(() => player.classList.add('idle'), 2200);
});

// scrubber
const scrub = $('#scrub');
const pct = (t) => `${(Math.max(0, t) / (realDur() || 1)) * 100}%`;
const tFromEvent = (e) => {
	const r = scrub.getBoundingClientRect();
	return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * realDur();
};
let dragging = false;
scrub.addEventListener('pointerdown', (e) => {
	dragging = true;
	scrub.setPointerCapture(e.pointerId);
	seek(tFromEvent(e));
});
scrub.addEventListener('pointermove', (e) => {
	const t = tFromEvent(e);
	const ch = chapterAt(t);
	$('#tip').style.left = pct(t);
	$('#tip').textContent = `${fmt(t)}${ch ? ` · ${ch.title}` : ''}`;
	if (dragging) seek(t);
});
scrub.addEventListener('pointerup', () => (dragging = false));

const chapterAt = (t) => [...(V?.ai?.chapters || [])].reverse().find((c) => c.t <= t + 0.01);

function renderMarks() {
	const d = realDur();
	if (!d) return;
	const chaps = (V.ai?.chapters || []).filter((c) => c.t > 0).map((c) => `<div class="chap" style="left:${pct(c.t)}"></div>`);
	const trims = [];
	if (tStart() > 0) trims.push(`<div class="trim-out" style="left:0;width:${pct(tStart())}"></div>`);
	if (V.trim?.end != null && V.trim.end < d) trims.push(`<div class="trim-out" style="left:${pct(V.trim.end)};right:0"></div>`);
	const rx = (V.reactions || []).slice(-60).map((r) => `<span class="rx" style="left:${pct(r.t)}">${r.emoji}</span>`);
	$('#marks').innerHTML = chaps.join('') + trims.join('') + rx.join('');
}

let lastTx = -1;
let lastCh = null;
function onTime() {
	const t = video.currentTime;
	if (V?.trim?.end != null && t >= V.trim.end && !video.paused) {
		video.pause();
		video.currentTime = V.trim.end;
	}
	$('#fill').style.width = pct(t);
	$('#knob').style.left = pct(t);
	$('#timeLbl').textContent = `${fmt(Math.max(0, t - tStart()))} / ${fmt(tEnd() - tStart())}`;
	$('#commentTime').textContent = fmt(t);
	const ch = chapterAt(t);
	$('#chapLbl').textContent = ch ? `· ${ch.title}` : '';
	if (ch !== lastCh) {
		lastCh = ch;
		$$('#paneSummary .chapters button').forEach((b) => b.classList.toggle('on', ch && Number(b.dataset.t) === ch.t));
	}
	const segs = V?.transcript || [];
	let idx = -1;
	for (let i = 0; i < segs.length; i++) if (segs[i].start <= t) idx = i;
	const cur = segs[idx];
	const active = cur && t <= (cur.end || cur.start) + 2.5 ? cur : null;
	$('#capOverlay').textContent = captionsOn && active ? active.text : '';
	if (idx !== lastTx) {
		lastTx = idx;
		$$('#paneTranscript .tx').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === idx));
		const el = $(`#paneTranscript .tx[data-i="${idx}"]`);
		if (el && !video.paused && $('#paneTranscript').classList.contains('on')) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}
}
video.addEventListener('timeupdate', onTime);
video.addEventListener('progress', () => {
	if (video.buffered.length) $('#buf').style.width = pct(video.buffered.end(video.buffered.length - 1));
});

// MediaRecorder WebM may lack a duration; force the browser to compute it.
video.addEventListener('loadedmetadata', () => {
	if (video.duration === Infinity || Number.isNaN(video.duration)) {
		const fix = () => {
			video.removeEventListener('durationchange', fix);
			if (Number.isFinite(video.duration)) {
				video.currentTime = tStart();
				renderMarks();
				onTime();
			}
		};
		video.addEventListener('durationchange', fix);
		video.currentTime = 1e101;
	} else {
		if (tStart()) video.currentTime = tStart();
		renderMarks();
		onTime();
	}
});

// keyboard
document.addEventListener('keydown', (e) => {
	if (e.target.closest('input, textarea, [contenteditable]')) return;
	const k = e.key.toLowerCase();
	if (k === ' ' || k === 'k') toggle();
	else if (k === 'arrowleft' || k === 'j') seek(video.currentTime - (k === 'j' ? 10 : 5));
	else if (k === 'arrowright' || k === 'l') seek(video.currentTime + (k === 'l' ? 10 : 5));
	else if (k === 'f') $('#fsBtn').click();
	else if (k === 'm') $('#muteBtn').click();
	else if (k === 'c') $('#ccBtn').click();
	else if (k === '>' || k === '.') setSpeed(speeds[Math.min(speeds.length - 1, speeds.indexOf(video.playbackRate) + 1)] || 1);
	else if (k === '<' || k === ',') setSpeed(speeds[Math.max(0, speeds.indexOf(video.playbackRate) - 1)] || 1);
	else if (/^[0-9]$/.test(k)) seek(tStart() + ((tEnd() - tStart()) * Number(k)) / 10);
	else return;
	e.preventDefault();
});

// ---------- render ----------
function renderMeta() {
	$('#meta').innerHTML = `
		<span>${ago(V.createdAt)}</span>
		<span>${icons.eye.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} ${V.views} view${V.views === 1 ? '' : 's'}</span>
		<span>${fmt(V.duration)}</span>
		${V.width ? `<span class="faint">${V.width}×${V.height}</span>` : ''}
		<span class="faint">${bytes(V.size || 0)}</span>
		${aiPill()}`;
}

function aiPill() {
	const s = V.ai?.status;
	if (s === 'done') return `<span class="pill ai">${icons.sparkle.replace('<svg', '<svg width="12" height="12"')} AI ready</span>`;
	if (['queued', 'processing', 'transcribing'].includes(s)) return `<span class="pill ai"><span class="spin"></span> ${s === 'transcribing' ? 'Transcribing' : 'AI working'}…</span>`;
	if (s === 'error') return `<span class="pill bad" title="${esc(V.ai.error)}"><span class="dot"></span>AI error</span>`;
	if (s === 'disabled') return `<span class="pill warn"><span class="dot"></span>AI off</span>`;
	return '';
}

function renderSummary() {
	const ai = V.ai || {};
	const pane = $('#paneSummary');
	if (['queued', 'processing', 'transcribing'].includes(ai.status)) {
		pane.innerHTML = `<div class="ai-card"><h4>${icons.sparkle.replace('<svg', '<svg width="14" height="14"')} Summary</h4>
			<div class="skeleton" style="height:12px;margin:8px 0"></div><div class="skeleton" style="height:12px;margin:8px 0;width:92%"></div><div class="skeleton" style="height:12px;width:70%"></div></div>
			<div class="sec-title">Chapters</div>${'<div class="skeleton" style="height:32px;margin:6px 0"></div>'.repeat(3)}`;
		return;
	}
	if (ai.status === 'disabled' || ai.status === 'error' || !ai.summary) {
		pane.innerHTML = `<div class="ai-card"><h4>${icons.sparkle.replace('<svg', '<svg width="14" height="14"')} AI summary</h4>
			<p class="muted">${
				ai.status === 'error'
					? `Grok request failed: ${esc(ai.error || '')}`
					: !cfg.ai
						? 'Set <span class="mono">GROK_API_KEY</span> in <span class="mono">.env</span> and restart to get titles, summaries, chapters and action items.'
						: !V.transcript?.length
							? 'No speech was captured, so there is nothing to summarize.'
							: 'Not generated yet.'
			}</p>
			${cfg.ai && V.transcript?.length ? `<button class="btn btn-sm" style="margin-top:12px" data-regen>${icons.refresh} Generate</button>` : ''}</div>`;
		return;
	}
	const done = store.get(`todo:${vid}`, {});
	pane.innerHTML = `
		<div class="ai-card"><h4>${icons.sparkle.replace('<svg', '<svg width="14" height="14"')} Summary</h4><p>${esc(ai.summary)}</p>
			${ai.tags?.length ? `<div class="tags">${ai.tags.map((t) => `<span class="pill">#${esc(t)}</span>`).join('')}</div>` : ''}</div>
		${ai.chapters?.length ? `<div class="sec-title">Chapters</div><div class="chapters">${ai.chapters.map((c) => `<button data-t="${c.t}"><span class="ts">${fmt(c.t)}</span><span>${esc(c.title)}</span></button>`).join('')}</div>` : ''}
		${ai.actionItems?.length ? `<div class="sec-title">Action items</div>${ai.actionItems.map((a, i) => `<label class="todo ${done[i] ? 'done' : ''}"><input type="checkbox" data-todo="${i}" ${done[i] ? 'checked' : ''}/><span>${esc(a)}</span></label>`).join('')}` : ''}
		${V.description ? `<div class="sec-title">Notes</div><p class="muted" style="white-space:pre-wrap">${esc(V.description)}</p>` : ''}
		<p class="faint" style="font-size:12px;margin-top:22px">Generated by ${esc(cfg.model || 'Grok')} ${ai.at ? ago(ai.at) : ''} · transcript from ${V.transcriptSource === 'whisper' ? 'Whisper' : 'live captions'}</p>`;
	lastCh = undefined;
	onTime();
}
$('#paneSummary').addEventListener('change', (e) => {
	const i = e.target.dataset.todo;
	if (i == null) return;
	const done = store.get(`todo:${vid}`, {});
	done[i] = e.target.checked;
	store.set(`todo:${vid}`, done);
	e.target.closest('.todo').classList.toggle('done', e.target.checked);
});
$('#paneSummary').addEventListener('click', (e) => e.target.closest('[data-regen]') && regen());

function renderTranscript() {
	const segs = V.transcript || [];
	const q = txFilter.toLowerCase();
	const hl = (s) => (q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`) : esc(s));
	const rows = segs.map((s, i) => ({ s, i })).filter(({ s }) => !q || s.text.toLowerCase().includes(q));
	$('#paneTranscript').innerHTML = `
		<div class="tx-search"><input class="input" id="txQ" placeholder="Search transcript" value="${esc(txFilter)}" /><button class="btn btn-sm" id="txCopy" title="Copy transcript">Copy</button></div>
		${
			segs.length
				? rows.map(({ s, i }) => `<div class="tx" data-i="${i}" data-t="${s.start}"><span class="ts">${fmt(s.start)}</span><span>${hl(s.text)}</span></div>`).join('') ||
					'<p class="faint">No matches.</p>'
				: `<p class="faint">No transcript. Live captions need Chrome/Edge with a mic, or set <span class="mono">TRANSCRIBE_API_KEY</span> for server transcription.</p>`
		}`;
	const inp = $('#txQ');
	inp.addEventListener('input', () => {
		txFilter = inp.value;
		renderTranscript();
		const n = $('#txQ');
		n.focus();
		n.setSelectionRange(n.value.length, n.value.length);
	});
	$('#txCopy').addEventListener('click', () => {
		navigator.clipboard.writeText(segs.map((s) => `[${fmt(s.start)}] ${s.text}`).join('\n'));
		toast('Transcript copied');
	});
	lastTx = -2;
	onTime();
}

function renderComments() {
	const list = [...(V.comments || [])].sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9) || a.at - b.at);
	$('#commentList').innerHTML = list.length
		? list
				.map(
					(c) => `<div class="comment">${avatar(c.author)}<div style="flex:1;min-width:0">
				<div><span class="who">${esc(c.author)}</span><span class="when">${ago(c.at)}</span>
				${c.author === store.get('name') ? `<button class="btn btn-ghost btn-sm btn-icon" style="float:right;height:22px;width:22px" data-delc="${c.id}" title="Delete">${icons.x}</button>` : ''}</div>
				<p>${c.t != null ? tsLink(c.t) : ''}${esc(c.text)}</p></div></div>`,
				)
				.join('')
		: '<p class="faint" style="padding:6px 0">No comments yet. Pause anywhere and leave one pinned to that moment.</p>';
	renderTabs();
}
$('#commentList').addEventListener('click', async (e) => {
	const b = e.target.closest('[data-delc]');
	if (!b) return;
	await api(`/videos/${vid}/comments/${b.dataset.delc}`, { method: 'DELETE' });
	V.comments = V.comments.filter((c) => c.id !== b.dataset.delc);
	renderComments();
});

function render() {
	document.title = `${V.title} — Glint`;
	if (document.activeElement !== $('#title')) $('#title').textContent = V.title;
	renderMeta();
	renderSummary();
	renderTranscript();
	renderComments();
	renderTabs();
	renderMarks();
}

// ---------- name ----------
function needName() {
	return new Promise((resolve) => {
		const n = store.get('name');
		if (n) return resolve(n);
		$('#nameModal').classList.add('on');
		$('#nameInput').focus();
		const done = () => {
			const v = $('#nameInput').value.trim();
			if (!v) return;
			store.set('name', v);
			$('#nameModal').classList.remove('on');
			resolve(v);
		};
		$('#nameSave').onclick = done;
		$('#nameInput').onkeydown = (e) => e.key === 'Enter' && done();
	});
}

// ---------- actions ----------
$('#title').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		e.target.blur();
	}
	if (e.key === 'Escape') {
		e.target.textContent = V.title;
		e.target.blur();
	}
});
$('#title').addEventListener('blur', async (e) => {
	const t = e.target.textContent.trim();
	if (!t || t === V.title) return (e.target.textContent = V.title);
	V = await api(`/videos/${vid}`, { method: 'PATCH', body: { title: t } });
	document.title = `${V.title} — Glint`;
	toast('Title saved');
});

$('#copyBtn').addEventListener('click', () => {
	navigator.clipboard.writeText(`${location.origin}/v/${vid}`);
	toast('Link copied');
});

$('#reacts').addEventListener('click', async (e) => {
	const b = e.target.closest('[data-e]');
	if (!b) return;
	const span = document.createElement('span');
	span.textContent = b.dataset.e;
	span.style.left = `${10 + Math.random() * 80}%`;
	$('#floaters').append(span);
	setTimeout(() => span.remove(), 2300);
	const r = await api(`/videos/${vid}/reactions`, { method: 'POST', body: { emoji: b.dataset.e, t: video.currentTime } });
	V.reactions.push(r);
	renderMarks();
});

async function postComment() {
	const text = $('#commentText').value.trim();
	if (!text) return;
	const author = await needName();
	const c = await api(`/videos/${vid}/comments`, { method: 'POST', body: { text, author, t: $('#commentAtTime').checked ? video.currentTime : null } });
	V.comments.push(c);
	$('#commentText').value = '';
	renderComments();
}
$('#commentSend').addEventListener('click', postComment);
$('#commentText').addEventListener('focus', () => video.pause());
$('#commentText').addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment();
});

async function regen() {
	await api(`/videos/${vid}/ai`, { method: 'POST', body: { resetTitle: true } });
	V.ai = { ...V.ai, status: 'queued' };
	render();
	poll();
}
$('#regenBtn').addEventListener('click', regen);

$('#delBtn').addEventListener('click', async () => {
	if (!confirm('Delete this video for everyone? This cannot be undone.')) return;
	await api(`/videos/${vid}`, { method: 'DELETE' });
	location.href = '/';
});

// draft message
let msgKind = 'chat';
async function draft() {
	$('#msgText').value = 'Writing…';
	try {
		const r = await api(`/videos/${vid}/message`, { method: 'POST', body: { kind: msgKind } });
		$('#msgText').value = r.text.trim();
	} catch (e) {
		$('#msgText').value = `Hey! Recorded a quick video: ${V.title}\n${location.origin}/v/${vid}`;
		toast(cfg.ai ? `AI failed: ${e.message}` : 'AI off — using a plain message');
	}
}
$('#msgBtn').addEventListener('click', () => {
	$('#msgModal').classList.add('on');
	draft();
});
$('#msgKind').addEventListener('click', (e) => {
	const b = e.target.closest('[data-v]');
	if (!b) return;
	msgKind = b.dataset.v;
	$$('#msgKind .chip').forEach((x) => x.classList.toggle('on', x === b));
	draft();
});
$('#msgRegen').addEventListener('click', draft);
$('#msgCopy').addEventListener('click', () => {
	navigator.clipboard.writeText($('#msgText').value);
	toast('Message copied');
});

// trim
const parseT = (s) => {
	const p = String(s).trim().split(':').map(Number);
	if (p.some(Number.isNaN)) return NaN;
	return p.reduce((a, b) => a * 60 + b, 0);
};
$('#trimBtn').addEventListener('click', () => {
	$('#trimStart').value = fmt(tStart());
	$('#trimEnd').value = fmt(tEnd());
	$('#trimModal').classList.add('on');
});
$('#trimStartNow').addEventListener('click', () => ($('#trimStart').value = fmt(video.currentTime)));
$('#trimEndNow').addEventListener('click', () => ($('#trimEnd').value = fmt(Math.ceil(video.currentTime))));
$('#trimReset').addEventListener('click', () => {
	$('#trimStart').value = fmt(0);
	$('#trimEnd').value = fmt(realDur());
});
$('#trimSave').addEventListener('click', async () => {
	const s = parseT($('#trimStart').value);
	let en = parseT($('#trimEnd').value);
	if (Number.isNaN(s) || Number.isNaN(en) || en <= s) return toast('End must be after start');
	if (en >= realDur() - 0.5) en = null;
	V = await api(`/videos/${vid}`, { method: 'PATCH', body: { trim: { start: s, end: en } } });
	$('#trimModal').classList.remove('on');
	seek(tStart());
	renderMarks();
	onTime();
	toast('Trim saved');
});

$$('.modal').forEach((m) =>
	m.addEventListener('click', (e) => {
		if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('on');
	}),
);
document.addEventListener('keydown', (e) => e.key === 'Escape' && $$('.modal.on').forEach((m) => m.id !== 'nameModal' && m.classList.remove('on')));

// ask AI
const suggestions = ['What are the key points?', 'What do I need to do?', 'Were any decisions made?', 'Explain it like I missed the meeting'];
function renderAsk(typing = false) {
	const list = $('#askList');
	list.innerHTML =
		(askHistory.length
			? ''
			: `<div class="ai-card" style="margin:0"><h4>${icons.sparkle.replace('<svg', '<svg width="14" height="14"')} Ask this video</h4><p class="muted">Grok reads the transcript and answers with clickable timestamps.</p></div><div class="suggest">${suggestions.map((s) => `<button>${s}</button>`).join('')}</div>`) +
		askHistory.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? linkify(m.content) : esc(m.content)}</div>`).join('') +
		(typing ? '<div class="msg assistant typing"><span class="spin"></span> Thinking…</div>' : '');
	list.scrollTop = list.scrollHeight;
}
$('#askList').addEventListener('click', (e) => {
	const b = e.target.closest('.suggest button');
	if (b) askQ(b.textContent);
});
async function askQ(q) {
	if (!q.trim()) return;
	if (!cfg.ai) return toast('Set GROK_API_KEY to use Ask AI');
	const history = [...askHistory];
	askHistory.push({ role: 'user', content: q });
	renderAsk(true);
	try {
		const r = await api(`/videos/${vid}/ask`, { method: 'POST', body: { question: q, history } });
		askHistory.push({ role: 'assistant', content: r.answer });
	} catch (e) {
		askHistory.push({ role: 'assistant', content: `Error: ${e.message}` });
	}
	renderAsk();
}
$('#askForm').addEventListener('submit', (e) => {
	e.preventDefault();
	const q = $('#askText').value;
	$('#askText').value = '';
	askQ(q);
});

// ---------- load ----------
let pollT;
function poll() {
	clearTimeout(pollT);
	pollT = setTimeout(async () => {
		const fresh = await api(`/videos/${vid}`);
		const was = V.ai?.status;
		V = { ...fresh, comments: fresh.comments, reactions: fresh.reactions };
		if (was !== V.ai?.status) render();
		else renderMeta();
		if (['queued', 'processing', 'transcribing'].includes(V.ai?.status)) poll();
		else if (V.ai?.status === 'done') toast('✨ AI summary ready');
	}, 2500);
}

(async () => {
	try {
		[V, cfg] = await Promise.all([api(`/videos/${vid}`), api('/config')]);
	} catch {
		document.querySelector('main').innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="orb"></div><h2>Video not found</h2><p>It may have been deleted.</p><a class="btn btn-primary" href="/">Back to library</a></div>`;
		return;
	}
	video.src = V.url;
	if (V.thumbUrl) video.poster = V.thumbUrl;
	$('#dlBtn').href = V.url;
	$('#dlBtn').setAttribute('download', `${V.title.replace(/[^\w\- ]+/g, '').trim() || 'video'}.${V.url.split('.').pop()}`);
	setPlayIcon();
	render();
	renderAsk();
	if (new URLSearchParams(location.search).get('new')) {
		history.replaceState(null, '', location.pathname);
		toast('Link copied — paste it anywhere');
	}
	if (['queued', 'processing', 'transcribing'].includes(V.ai?.status)) poll();
	const t = new URLSearchParams(location.search).get('t');
	if (t) video.addEventListener('loadedmetadata', () => seek(Number(t)), { once: true });
})();
