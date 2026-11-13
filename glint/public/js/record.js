import { $, $$, api, fmt, icons, toast, topbar, store, bytes, requireOwner } from './common.js';

$('#top').innerHTML = topbar(`<a class="btn btn-ghost" href="/">Library</a>`);

// ---------- settings ----------
const S = {
	mode: store.get('mode', 'screen-cam'),
	corner: store.get('corner', 'bl'),
	size: store.get('size', 'm'),
	quality: store.get('quality', '1080'),
	sys: store.get('sys', true),
	caps: store.get('caps', true),
	count: store.get('count', true),
	mirror: store.get('mirror', true),
	pip: store.get('pip', true),
	cam: store.get('camId', ''),
	mic: store.get('micId', ''),
};
const save = () => {
	for (const [k, v] of Object.entries({ mode: S.mode, corner: S.corner, size: S.size, quality: S.quality, sys: S.sys, caps: S.caps, count: S.count, mirror: S.mirror, pip: S.pip, camId: S.cam, micId: S.mic })) store.set(k, v);
};

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
	S.caps = false;
	$('#optCaps').disabled = true;
	$('#optCaps').closest('.toggle').title = 'Live captions need Chrome or Edge';
}
if (!('documentPictureInPicture' in window)) {
	S.pip = false;
	$('#optPip').disabled = true;
}
if (!navigator.mediaDevices?.getDisplayMedia) {
	S.mode = 'cam';
	$$('#modes [data-mode^="screen"]').forEach((b) => (b.disabled = true));
}

const modeMeta = {
	'screen-cam': [icons.screenCam, 'Screen + Cam'],
	screen: [icons.screen, 'Screen'],
	cam: [icons.cam, 'Camera'],
};
$$('#modes button').forEach((b) => (b.innerHTML = `${modeMeta[b.dataset.mode][0]}${modeMeta[b.dataset.mode][1]}`));
$('#pauseBtn').innerHTML = icons.pause;
$('#camToggle').innerHTML = icons.cam;
$('#restartBtn').innerHTML = icons.restart;
$('#cancelBtn').innerHTML = icons.trash;

function syncUI() {
	$$('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
	$$('#corner .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === S.corner));
	$$('#size .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === S.size));
	$$('#quality .chip').forEach((b) => b.classList.toggle('on', b.dataset.v === S.quality));
	$('#camField').style.display = S.mode === 'screen' ? 'none' : '';
	$('#bubbleOpts').style.display = S.mode === 'screen-cam' ? '' : 'none';
	$('#sysAudioRow').style.display = S.mode === 'cam' ? 'none' : '';
	$('#optSys').checked = S.sys;
	$('#optCaps').checked = S.caps;
	$('#optCount').checked = S.count;
	$('#optMirror').checked = S.mirror;
	$('#optPip').checked = S.pip;
}

const bindChips = (sel, key) =>
	$(sel).addEventListener('click', (e) => {
		const b = e.target.closest('[data-v]');
		if (!b) return;
		S[key] = b.dataset.v;
		save();
		syncUI();
		if (key === 'quality') sizeCanvas();
	});
bindChips('#corner', 'corner');
bindChips('#size', 'size');
bindChips('#quality', 'quality');
$('#modes').addEventListener('click', async (e) => {
	const b = e.target.closest('[data-mode]');
	if (!b || rec) return;
	S.mode = b.dataset.mode;
	save();
	syncUI();
	sizeCanvas();
	await ensureCam();
});
for (const [id, key] of [['#optSys', 'sys'], ['#optCaps', 'caps'], ['#optCount', 'count'], ['#optMirror', 'mirror'], ['#optPip', 'pip']]) {
	$(id).addEventListener('change', (e) => {
		S[key] = e.target.checked;
		save();
	});
}

// ---------- devices ----------
let camStream = null;
let micStream = null;
const camVideo = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
let audioCtx = null;
let analyser = null;

async function listDevices() {
	const devs = await navigator.mediaDevices.enumerateDevices();
	const fill = (sel, kind, cur, none) => {
		const opts = devs.filter((d) => d.kind === kind);
		sel.innerHTML =
			(none ? `<option value="none">${none}</option>` : '') +
			opts.map((d, i) => `<option value="${d.deviceId}">${d.label || `${kind === 'videoinput' ? 'Camera' : 'Mic'} ${i + 1}`}</option>`).join('');
		if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
		else if (sel.options.length > 1) sel.selectedIndex = 1; // first real device
	};
	fill($('#camSel'), 'videoinput', S.cam, 'No camera');
	fill($('#micSel'), 'audioinput', S.mic, 'No microphone');
	S.cam = $('#camSel').value;
	S.mic = $('#micSel').value;
}

async function ensureCam() {
	const want = S.mode !== 'screen' && S.cam !== 'none';
	const curId = camStream?.getVideoTracks()[0]?.getSettings().deviceId;
	if (want && camStream && (curId === S.cam || !S.cam)) return;
	camStream?.getTracks().forEach((t) => t.stop());
	camStream = null;
	camVideo.srcObject = null;
	if (!want) return;
	try {
		camStream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: S.cam ? { exact: S.cam } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
		});
		camVideo.srcObject = camStream;
		await camVideo.play().catch(() => {});
	} catch (e) {
		toast(`Camera unavailable: ${e.message}`);
	}
}

async function ensureMic() {
	micStream?.getTracks().forEach((t) => t.stop());
	micStream = null;
	if (S.mic === 'none') return;
	try {
		micStream = await navigator.mediaDevices.getUserMedia({
			audio: { deviceId: S.mic ? { exact: S.mic } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
		});
		audioCtx ??= new AudioContext();
		analyser = audioCtx.createAnalyser();
		analyser.fftSize = 512;
		audioCtx.createMediaStreamSource(micStream).connect(analyser);
	} catch (e) {
		toast(`Microphone unavailable: ${e.message}`);
	}
}

$('#camSel').addEventListener('change', async (e) => {
	S.cam = e.target.value;
	save();
	await ensureCam();
});
$('#micSel').addEventListener('change', async (e) => {
	S.mic = e.target.value;
	save();
	await ensureMic();
});

const lvlBuf = new Uint8Array(256);
function meter() {
	if (analyser) {
		analyser.getByteTimeDomainData(lvlBuf);
		let peak = 0;
		for (const v of lvlBuf) peak = Math.max(peak, Math.abs(v - 128));
		$('#level').style.width = `${Math.min(100, (peak / 128) * 160)}%`;
	}
	requestAnimationFrame(meter);
}

// ---------- compositor ----------
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const screenVideo = Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true });
let screenStream = null;
let camHidden = false;

function sizeCanvas() {
	const q = Number(S.quality);
	if (S.mode !== 'cam' && screenStream) {
		const st = screenStream.getVideoTracks()[0].getSettings();
		const w = st.width || 1920;
		const h = st.height || 1080;
		const scale = Math.min(1, q / Math.min(w, h));
		canvas.width = Math.round((w * scale) / 2) * 2;
		canvas.height = Math.round((h * scale) / 2) * 2;
	} else {
		canvas.height = q;
		canvas.width = Math.round((q * 16) / 9 / 2) * 2;
	}
}

function drawCover(src, sw, sh, x, y, w, h, mirror) {
	const r = Math.max(w / sw, h / sh);
	const dw = sw * r;
	const dh = sh * r;
	ctx.save();
	if (mirror) {
		ctx.translate(x + w, y);
		ctx.scale(-1, 1);
		x = 0;
		y = 0;
	}
	ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
	ctx.restore();
}

function idleBackdrop() {
	const { width: W, height: H } = canvas;
	const g = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W * 0.5, H * 0.5, W * 0.8);
	g.addColorStop(0, '#1d1236');
	g.addColorStop(0.5, '#0d0a18');
	g.addColorStop(1, '#050508');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = 'rgba(255,255,255,0.04)';
	const step = Math.round(W / 32);
	for (let x = step; x < W; x += step) for (let y = step; y < H; y += step) ctx.fillRect(x, y, 2, 2);
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.font = `700 ${Math.round(H * 0.05)}px Inter, system-ui, sans-serif`;
	ctx.fillText(S.mode === 'cam' ? 'Camera off' : 'Your screen shows up here', W / 2, H / 2 - H * 0.01);
	ctx.fillStyle = 'rgba(255,255,255,0.45)';
	ctx.font = `500 ${Math.round(H * 0.025)}px Inter, system-ui, sans-serif`;
	ctx.fillText(S.mode === 'cam' ? 'Pick a camera on the left' : 'Hit Start and choose a tab, window or screen', W / 2, H / 2 + H * 0.045);
}

function draw() {
	const { width: W, height: H } = canvas;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, W, H);
	const camReady = camStream && camVideo.videoWidth;

	if (S.mode === 'cam') {
		if (camReady && !camHidden) drawCover(camVideo, camVideo.videoWidth, camVideo.videoHeight, 0, 0, W, H, S.mirror);
		else idleBackdrop();
		return;
	}
	if (screenStream && screenVideo.videoWidth) {
		const r = Math.min(W / screenVideo.videoWidth, H / screenVideo.videoHeight);
		const dw = screenVideo.videoWidth * r;
		const dh = screenVideo.videoHeight * r;
		ctx.drawImage(screenVideo, (W - dw) / 2, (H - dh) / 2, dw, dh);
	} else idleBackdrop();

	if (S.mode === 'screen-cam' && camReady && !camHidden) {
		const d = Math.round(Math.min(W, H) * { s: 0.18, m: 0.26, l: 0.36 }[S.size]);
		const m = Math.round(Math.min(W, H) * 0.035);
		const x = S.corner.includes('l') ? m : W - d - m;
		const y = S.corner.includes('t') ? m : H - d - m;
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,0.55)';
		ctx.shadowBlur = d * 0.12;
		ctx.shadowOffsetY = d * 0.03;
		ctx.beginPath();
		ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
		ctx.fillStyle = '#000';
		ctx.fill();
		ctx.restore();
		ctx.save();
		ctx.beginPath();
		ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
		ctx.clip();
		drawCover(camVideo, camVideo.videoWidth, camVideo.videoHeight, x, y, d, d, S.mirror);
		ctx.restore();
		const ring = ctx.createLinearGradient(x, y, x + d, y + d);
		ring.addColorStop(0, '#8b5cff');
		ring.addColorStop(0.6, '#ff4fa3');
		ring.addColorStop(1, '#ffb547');
		ctx.lineWidth = Math.max(3, d * 0.022);
		ctx.strokeStyle = ring;
		ctx.beginPath();
		ctx.arc(x + d / 2, y + d / 2, d / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
		ctx.stroke();
	}
}

// A worker-driven clock keeps drawing even when this tab is in the background.
const ticker = new Worker(
	URL.createObjectURL(new Blob(['let t;onmessage=e=>{clearInterval(t);if(e.data)t=setInterval(()=>postMessage(0),e.data)}'], { type: 'text/javascript' })),
);
ticker.onmessage = draw;
ticker.postMessage(1000 / 30);

// ---------- recording ----------
let rec = null; // { recorder, chunks, startedAt, pausedAt, pausedTotal, mixed, transcript, thumb }
let timerInt = null;
let recognition = null;
let pipWin = null;

const elapsed = () => {
	if (!rec) return 0;
	const now = rec.pausedAt ?? performance.now();
	return Math.max(0, (now - rec.startedAt - rec.pausedTotal) / 1000);
};

function pickMime() {
	const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
	return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

async function countdown() {
	if (!S.count) return;
	const el = $('#countdown');
	el.classList.add('on');
	for (const n of [3, 2, 1]) {
		el.innerHTML = `<span class="grad-text">${n}</span>`;
		await new Promise((r) => setTimeout(r, 900));
	}
	el.classList.remove('on');
}

async function start() {
	$('#startBtn').disabled = true;
	try {
		if (!micStream && S.mic !== 'none') await ensureMic();
		if (S.mode !== 'cam') {
			screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: { frameRate: { ideal: 30 }, width: { ideal: 2560 }, height: { ideal: 1440 } },
				audio: S.sys,
				selfBrowserSurface: 'exclude',
				surfaceSwitching: 'include',
				systemAudio: 'include',
			});
			screenVideo.srcObject = screenStream;
			await screenVideo.play().catch(() => {});
			screenStream.getVideoTracks()[0].addEventListener('ended', () => rec && stop());
		}
		sizeCanvas();
		await countdown();

		audioCtx ??= new AudioContext();
		await audioCtx.resume();
		const dest = audioCtx.createMediaStreamDestination();
		if (micStream) audioCtx.createMediaStreamSource(micStream).connect(dest);
		if (screenStream?.getAudioTracks().length) audioCtx.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks())).connect(dest);

		const out = canvas.captureStream(30);
		const mixed = new MediaStream([...out.getVideoTracks(), ...dest.stream.getAudioTracks()]);
		const mimeType = pickMime();
		const vbr = { 720: 2_500_000, 1080: 5_000_000, 1440: 8_000_000 }[S.quality];
		const recorder = new MediaRecorder(mixed, { mimeType, videoBitsPerSecond: vbr, audioBitsPerSecond: 128_000 });
		// Separate low-bitrate audio track: small enough to send to Whisper for the transcript.
		const aTracks = dest.stream.getAudioTracks();
		const aType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
		const audioRec = aTracks.length && aType ? new MediaRecorder(new MediaStream(aTracks), { mimeType: aType, audioBitsPerSecond: 32_000 }) : null;
		rec = { recorder, audioRec, chunks: [], audioChunks: [], startedAt: performance.now(), pausedAt: null, pausedTotal: 0, mixed, transcript: [], thumb: null, mime: recorder.mimeType || mimeType, audioMime: audioRec?.mimeType || aType };
		const cur = rec;
		recorder.ondataavailable = (e) => e.data.size && cur.chunks.push(e.data);
		if (audioRec) audioRec.ondataavailable = (e) => e.data.size && cur.audioChunks.push(e.data);
		recorder.start(1000);
		audioRec?.start(1000);

		setTimeout(grabThumb, 1500);
		startCaptions();
		$('#recBar').classList.add('on');
		$('#recBar').classList.remove('paused');
		document.body.classList.add('recording');
		timerInt = setInterval(tick, 250);
		tick();
		if (S.pip) openPip();
	} catch (e) {
		if (e.name !== 'NotAllowedError') toast(e.message);
		cleanupScreen();
	} finally {
		$('#startBtn').disabled = false;
	}
}

function grabThumb() {
	if (!rec || rec.thumb) return;
	const c = document.createElement('canvas');
	c.width = 640;
	c.height = Math.round((640 * canvas.height) / canvas.width);
	c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
	c.toBlob((b) => rec && (rec.thumb = b), 'image/jpeg', 0.82);
}

function tick() {
	const t = fmt(elapsed());
	$('#time').textContent = t;
	document.title = `● ${t} — Glint`;
	if (pipWin) pipWin.document.getElementById('t').textContent = t;
}

function togglePause() {
	if (!rec) return;
	const paused = rec.recorder.state === 'paused';
	if (paused) {
		rec.pausedTotal += performance.now() - rec.pausedAt;
		rec.pausedAt = null;
		rec.recorder.resume();
		rec.audioRec?.resume();
		startCaptions();
	} else {
		rec.pausedAt = performance.now();
		rec.recorder.pause();
		rec.audioRec?.pause();
		stopCaptions();
	}
	$('#recBar').classList.toggle('paused', !paused);
	$('#pauseBtn').innerHTML = paused ? icons.pause : icons.play;
	if (pipWin) pipWin.document.getElementById('p').innerHTML = paused ? icons.pause : icons.play;
}

function toggleCam() {
	camHidden = !camHidden;
	$('#camToggle').style.opacity = camHidden ? 0.4 : 1;
}

function stopCaptions() {
	if (recognition) {
		recognition.onend = null;
		recognition.stop();
		recognition = null;
	}
	$('#caps').classList.remove('on');
}

function startCaptions() {
	if (!S.caps || !SR || !micStream) return;
	stopCaptions();
	const r = new SR();
	r.continuous = true;
	r.interimResults = true;
	r.lang = navigator.language || 'en-US';
	const starts = {};
	r.onresult = (e) => {
		let interim = '';
		for (let i = e.resultIndex; i < e.results.length; i++) {
			const res = e.results[i];
			starts[i] ??= Math.max(0, elapsed() - 1.2);
			if (res.isFinal) {
				const text = res[0].transcript.trim();
				if (text && rec) rec.transcript.push({ start: +starts[i].toFixed(2), end: +elapsed().toFixed(2), text: text[0].toUpperCase() + text.slice(1) });
			} else interim += res[0].transcript;
		}
		const last = rec?.transcript.at(-1)?.text || '';
		$('#caps').textContent = interim || last;
		$('#caps').classList.toggle('on', Boolean(interim || last));
	};
	r.onerror = (e) => {
		if (e.error === 'not-allowed') S.caps = false;
	};
	r.onend = () => {
		if (rec && rec.recorder.state === 'recording' && recognition === r) {
			try {
				r.start();
			} catch {}
		}
	};
	recognition = r;
	try {
		r.start();
	} catch {}
}

function cleanupScreen() {
	screenStream?.getTracks().forEach((t) => t.stop());
	screenStream = null;
	screenVideo.srcObject = null;
}

function teardown() {
	clearInterval(timerInt);
	stopCaptions();
	cleanupScreen();
	pipWin?.close();
	pipWin = null;
	$('#recBar').classList.remove('on');
	document.body.classList.remove('recording');
	document.title = 'Glint — Record';
	$('#pauseBtn').innerHTML = icons.pause;
	sizeCanvas();
}

function stopRecorder() {
	const one = (r) =>
		new Promise((resolve) => {
			if (!r || r.state === 'inactive') return resolve();
			r.onstop = resolve;
			if (r.state === 'paused') r.resume();
			r.stop();
		});
	return Promise.all([one(rec.recorder), one(rec.audioRec)]);
}

async function stop() {
	if (!rec) return;
	const cur = rec;
	if (cur.pausedAt) {
		cur.pausedTotal += performance.now() - cur.pausedAt;
		cur.pausedAt = null;
	}
	const duration = elapsed();
	grabThumb();
	await new Promise((r) => setTimeout(r, 150));
	await stopRecorder();
	const meta = { duration, width: canvas.width, height: canvas.height, mode: S.mode, transcript: cur.transcript };
	const blob = new Blob(cur.chunks, { type: cur.mime.split(';')[0] || 'video/webm' });
	const thumb = cur.thumb;
	const audio = cur.audioChunks.length ? new Blob(cur.audioChunks, { type: (cur.audioMime || 'audio/webm').split(';')[0] }) : null;
	cur.mixed.getTracks().forEach((t) => t.stop());
	rec = null;
	teardown();
	if (duration < 0.8) return toast('Too short — nothing saved');
	upload(blob, thumb, meta, audio);
}

async function discard(restart = false) {
	if (!rec) return;
	if (!restart && !confirm('Discard this recording?')) return;
	const keepScreen = restart ? screenStream : null;
	await stopRecorder();
	rec = null;
	if (keepScreen) {
		clearInterval(timerInt);
		stopCaptions();
		pipWin?.close();
		pipWin = null;
		$('#recBar').classList.remove('on');
		// reuse the same screen share
		return restartWith(keepScreen);
	}
	teardown();
	toast('Recording discarded');
}

async function restartWith(stream) {
	screenStream = stream;
	const old = S.mode;
	// start() asks for a new display stream; temporarily bypass by faking cam mode for the picker step
	const gdm = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
	navigator.mediaDevices.getDisplayMedia = async () => stream;
	try {
		S.mode = old;
		await start();
	} finally {
		navigator.mediaDevices.getDisplayMedia = gdm;
	}
}

const extOf = (type = '') => (type.includes('mp4') ? (type.startsWith('audio') ? 'm4a' : 'mp4') : type.includes('jpeg') ? 'jpg' : 'webm');

function progress(loaded, total) {
	$('#upBar').style.width = `${Math.min(100, (loaded / total) * 100)}%`;
	$('#upStat').textContent = `${bytes(loaded)} / ${bytes(total)}`;
}

function uploadLocal(blob, thumb, meta, audio) {
	return new Promise((resolve, reject) => {
		const fd = new FormData();
		fd.append('video', blob, `recording.${extOf(blob.type)}`);
		if (thumb) fd.append('thumb', thumb, 'thumb.jpg');
		if (audio) fd.append('audio', audio, `audio.${extOf(audio.type)}`);
		fd.append('meta', JSON.stringify(meta));
		const xhr = new XMLHttpRequest();
		xhr.open('POST', '/api/videos');
		xhr.upload.onprogress = (e) => e.lengthComputable && progress(e.loaded, e.total);
		xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`HTTP ${xhr.status}`)));
		xhr.onerror = () => reject(new Error('Network error'));
		xhr.send(fd);
	});
}

async function uploadBlob(blob, thumb, meta, audio) {
	const { upload: put } = await import('/vendor/blob-client.js');
	const stamp = `${Date.now().toString(36)}`;
	const total = blob.size + (thumb?.size || 0) + (audio?.size || 0);
	let done = 0;
	const send = async (file, name) => {
		if (!file) return null;
		const r = await put(`media/${stamp}-${name}.${extOf(file.type)}`, file, {
			access: 'public',
			handleUploadUrl: '/api/upload',
			contentType: file.type,
			multipart: file.size > 50e6,
			onUploadProgress: (p) => progress(done + p.loaded, total),
		});
		done += file.size;
		return r.url;
	};
	const [thumbUrl, audioUrl] = await Promise.all([send(thumb, 'thumb'), send(audio, 'audio')]);
	const videoUrl = await send(blob, 'video');
	return api('/videos', {
		method: 'POST',
		body: { videoUrl, thumbUrl, audioUrl, audioMime: audio?.type || null, mime: blob.type, size: blob.size, meta },
	});
}

async function upload(blob, thumb, meta, audio) {
	$('#uploading').classList.add('on');
	$('#upMsg').textContent = 'Uploading…';
	try {
		const v = await (cfg.storage === 'blob' ? uploadBlob : uploadLocal)(blob, thumb, meta, audio);
		$('#upMsg').textContent = 'Done. Opening your video…';
		navigator.clipboard?.writeText(`${location.origin}/v/${v.id}`).catch(() => {});
		location.href = `/v/${v.id}?new=1`;
	} catch (e) {
		$('#upMsg').textContent = `${e.message} — retrying in 3s`;
		setTimeout(() => upload(blob, thumb, meta, audio), 3000);
	}
}

// ---------- floating controls (Document Picture-in-Picture) ----------
async function openPip() {
	try {
		pipWin = await window.documentPictureInPicture.requestWindow({ width: 300, height: S.mode === 'screen' ? 90 : 330 });
		const d = pipWin.document;
		[...document.styleSheets].forEach((ss) => {
			try {
				const st = d.createElement('style');
				st.textContent = [...ss.cssRules].map((r) => r.cssText).join('\n');
				d.head.append(st);
			} catch {
				const l = d.createElement('link');
				l.rel = 'stylesheet';
				l.href = ss.href;
				d.head.append(l);
			}
		});
		d.body.style.cssText = 'margin:0;background:#07070b;display:flex;flex-direction:column;height:100vh;overflow:hidden';
		d.body.innerHTML = `
			${S.mode !== 'screen' ? '<div style="flex:1;position:relative;overflow:hidden"><video id="v" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;' + (S.mirror ? 'transform:scaleX(-1)' : '') + '"></video></div>' : ''}
			<div class="rec-bar on" style="position:static;transform:none;border-radius:0;justify-content:center;width:100%;border:0;border-top:1px solid rgba(255,255,255,.1)">
				<div class="rec-time"><span class="rec-dot"></span><span id="t">0:00</span></div>
				<button class="btn btn-icon btn-ghost" id="p">${icons.pause}</button>
				<button class="stop-btn" id="s"><i></i></button>
			</div>`;
		if (camStream) d.getElementById('v').srcObject = camStream;
		d.getElementById('p').onclick = togglePause;
		d.getElementById('s').onclick = stop;
		pipWin.addEventListener('pagehide', () => (pipWin = null));
	} catch {
		pipWin = null;
	}
}

// ---------- wire up ----------
$('#startBtn').addEventListener('click', start);
$('#stopBtn').addEventListener('click', stop);
$('#pauseBtn').addEventListener('click', togglePause);
$('#camToggle').addEventListener('click', toggleCam);
$('#cancelBtn').addEventListener('click', () => discard(false));
$('#restartBtn').addEventListener('click', () => discard(true));
document.addEventListener('keydown', (e) => {
	if (!e.altKey) return;
	const k = e.key.toLowerCase();
	if (k === 'p') togglePause();
	else if (k === 's') stop();
	else if (k === 'c') toggleCam();
	else return;
	e.preventDefault();
});
window.addEventListener('beforeunload', (e) => {
	if (rec) e.preventDefault();
});

let cfg = {};
syncUI();
sizeCanvas();
(async () => {
	await requireOwner();
	cfg = await api('/config').catch(() => ({}));
	try {
		// One permission prompt up front so device labels populate.
		const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: S.mode !== 'screen' });
		tmp.getTracks().forEach((t) => t.stop());
	} catch {}
	await listDevices();
	save();
	await Promise.all([ensureCam(), ensureMic()]);
	meter();
	navigator.mediaDevices.addEventListener?.('devicechange', listDevices);
})();
