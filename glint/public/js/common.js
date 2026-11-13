export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export async function api(path, opts = {}) {
	const res = await fetch(`/api${path}`, {
		...opts,
		headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
		body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
	return data;
}

export const fmt = (s) => {
	if (!Number.isFinite(s)) s = 0;
	s = Math.max(0, Math.floor(s));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export const ago = (ts) => {
	const d = (Date.now() - ts) / 1000;
	if (d < 60) return 'just now';
	if (d < 3600) return `${Math.floor(d / 60)}m ago`;
	if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
	if (d < 604800) return `${Math.floor(d / 86400)}d ago`;
	return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const esc = (s = '') =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const bytes = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export function avatar(name = '?') {
	let h = 0;
	for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
	return `<div class="avatar" style="background:linear-gradient(135deg,hsl(${h} 80% 60%),hsl(${(h + 50) % 360} 80% 50%))">${esc(name.trim()[0]?.toUpperCase() || '?')}</div>`;
}

export function toast(msg, ms = 2400) {
	let wrap = $('.toast-wrap');
	if (!wrap) {
		wrap = document.createElement('div');
		wrap.className = 'toast-wrap';
		document.body.append(wrap);
	}
	const t = document.createElement('div');
	t.className = 'toast';
	t.textContent = msg;
	wrap.append(t);
	setTimeout(() => t.remove(), ms);
}

export const store = {
	get(k, d) {
		try {
			const v = localStorage.getItem(`glint:${k}`);
			return v == null ? d : JSON.parse(v);
		} catch {
			return d;
		}
	},
	set(k, v) {
		try {
			localStorage.setItem(`glint:${k}`, JSON.stringify(v));
		} catch {}
	},
};

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const icons = {
	plus: P('<path d="M12 5v14M5 12h14"/>'),
	search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
	play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>',
	pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>',
	screen: P('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
	screenCam: P('<rect x="2" y="4" width="20" height="13" rx="2"/><circle cx="17" cy="13" r="3.2" fill="currentColor" stroke="none"/><path d="M8 21h8"/>'),
	cam: P('<path d="m16 10 5-3v10l-5-3"/><rect x="2" y="6" width="14" height="12" rx="2"/>'),
	mic: P('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>'),
	eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
	chat: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/>'),
	link: P('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
	download: P('<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>'),
	trash: P('<path d="M3 6h18M8 6V4h8v2m1 0-1 14H8L7 6"/>'),
	sparkle: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>'),
	scissors: P('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'),
	full: P('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
	vol: P('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
	mute: P('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m23 9-6 6M17 9l6 6"/>'),
	cc: P('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/>'),
	back10: P('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
	fwd10: P('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
	pip: P('<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/>'),
	send: P('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>'),
	mail: P('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>'),
	clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
	text: P('<path d="M4 6h16M4 12h16M4 18h10"/>'),
	refresh: P('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
	restart: P('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
	x: P('<path d="M18 6 6 18M6 6l12 12"/>'),
	more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};

export function topbar(right = '') {
	return `<header class="topbar">
		<a class="brand" href="/"><span class="brand-mark"></span>Glint</a>
		<div class="spacer"></div>${right}
	</header>`;
}

// ---------- auth ----------
let meCache;
export const me = () => (meCache ??= api('/me').catch(() => ({ owner: true, locked: false })));

// Resolves once the visitor is the owner (shows a password screen if the app is locked).
export async function requireOwner() {
	const m = await me();
	if (m.owner) return;
	await new Promise((resolve) => {
		const wrap = document.createElement('div');
		wrap.className = 'modal on';
		wrap.innerHTML = `<form class="modal-card" style="width:min(400px,100%);text-align:center">
			<div class="orb" style="width:56px;height:56px"></div>
			<h3 style="margin-top:16px">Welcome back</h3>
			<p class="muted" style="margin:0 0 16px">Enter your Glint password.</p>
			<input class="input" type="password" name="pw" autocomplete="current-password" placeholder="Password" style="width:100%" />
			<p class="faint" id="loginErr" style="min-height:20px;margin:8px 0 0;color:var(--bad)"></p>
			<button class="btn btn-primary" style="width:100%;margin-top:6px">Unlock</button>
		</form>`;
		document.body.append(wrap);
		const f = wrap.querySelector('form');
		f.pw.focus();
		f.addEventListener('submit', async (e) => {
			e.preventDefault();
			try {
				await api('/login', { method: 'POST', body: { password: f.pw.value } });
				meCache = Promise.resolve({ owner: true, locked: true });
				wrap.remove();
				resolve();
			} catch (err) {
				$('#loginErr', wrap).textContent = err.message;
			}
		});
	});
}
