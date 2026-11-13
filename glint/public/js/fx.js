// Glint motion: 5s intro (first visit per session), page transitions, loading screen.
const STAR = 'M46.5 8.5Q46.5 17.5 55.5 17.5Q46.5 17.5 46.5 26.5Q46.5 17.5 37.5 17.5Q46.5 17.5 46.5 8.5Z';
const ARC = 'M44.77 31.4A15 15 0 1 1 35.13 19.9';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const mark = (cls = '') =>
	`<svg class="mark ${cls}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
		<rect class="m-tile" width="64" height="64" rx="17" fill="#0d0b16"/>
		<rect class="m-border" x=".5" y=".5" width="63" height="63" rx="16.5" stroke="#fff" stroke-opacity=".12"/>
		<path class="m-arc" pathLength="100" d="${ARC}" stroke="url(#gl-a)" stroke-width="5.5" stroke-linecap="round"/>
		<circle class="m-dot" cx="30" cy="34" r="5.5" fill="url(#gl-a)"/>
		<path class="m-star" d="${STAR}" fill="#fff"/>
	</svg>`;

export const loaderHTML = (label = '') =>
	`<div class="ld">${mark('spin-mark')}<div class="ld-bar"></div>${label ? `<div class="mono" style="color:rgba(255,255,255,.5);letter-spacing:.2em;text-transform:uppercase;font-size:11px">${label}</div>` : ''}</div>`;

// shared gradient for every inline mark
const defs = document.createElement('div');
defs.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
	<linearGradient id="gl-a" x1="14" y1="50" x2="52" y2="12" gradientUnits="userSpaceOnUse">
		<stop offset="0" stop-color="#7a5cff"/><stop offset=".55" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ffc06b"/>
	</linearGradient></defs></svg>`;
document.body.prepend(defs.firstChild);

// ---------- veil ----------
let veil = document.getElementById('fx-veil');
if (!veil) {
	veil = document.createElement('div');
	veil.id = 'fx-veil';
	veil.className = 'covered';
	document.body.append(veil);
}
veil.innerHTML = `<div class="p p1"></div><div class="p p2"></div>${loaderHTML()}`;

const holds = [];
/** Keep the loading screen up until this promise settles (max ~3s). */
export const hold = (p) => {
	holds.push(Promise.resolve(p).catch(() => {}));
	return p;
};

let revealed = false;
function reveal() {
	if (revealed) return;
	revealed = true;
	document.body.classList.add('fx-enter');
	if (veil.classList.contains('gone')) return;
	veil.className = 'out';
	setTimeout(() => (veil.className = 'gone'), 800);
}

/** Animated navigation to another page. */
export function go(href) {
	if (reduced) return void (location.href = href);
	veil.className = 'in';
	setTimeout(() => (location.href = href), 540);
}

document.addEventListener('click', (e) => {
	const a = e.target.closest('a[href]');
	if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	if (e.target.closest('button') || a.target === '_blank' || a.hasAttribute('download')) return;
	const url = new URL(a.href, location.href);
	if (url.origin !== location.origin || /^\/(api|media|vendor)\//.test(url.pathname)) return;
	if (url.pathname === location.pathname && url.search === location.search) return;
	e.preventDefault();
	go(url.href);
});
addEventListener('pageshow', (e) => {
	if (e.persisted) {
		veil.className = 'gone';
		document.querySelector('#fx-intro')?.remove();
	}
});

// ---------- intro ----------
let introSeen = false;
try {
	introSeen = sessionStorage.getItem('glint:intro') === '1' && !new URLSearchParams(location.search).has('intro');
	sessionStorage.setItem('glint:intro', '1');
} catch {}

const pageReady = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })))
	.then(() => new Promise((r) => setTimeout(r, 0)))
	.then(() => Promise.race([Promise.all(holds), new Promise((r) => setTimeout(r, 3000))]));

if (introSeen) {
	pageReady.then(reveal);
} else {
	veil.className = 'gone';
	runIntro();
}

function runIntro() {
	const el = document.createElement('div');
	el.id = 'fx-intro';
	el.innerHTML = `
		<canvas></canvas><div class="vignette"></div><div class="grain"></div>
		<div class="fx-stage">
			<div class="logo-wrap"><div class="halo"></div>${mark()}<div class="flare"></div><div class="flash"></div><div class="shock"></div><div class="shock s2"></div></div>
			<div class="word">${[...'Glint'].map((c, i) => `<span style="animation:letter .75s cubic-bezier(.2,.8,.2,1) ${2.6 + i * 0.075}s forwards,glowLetter .8s ease-in-out ${3.45 + i * 0.07}s">${c}</span>`).join('')}</div>
			<div class="tag">Record <b>·</b> Share <b>·</b> Skip the meeting</div>
		</div>
		<div class="skip">Tap to skip</div>`;
	document.body.append(el);
	document.documentElement.style.overflow = 'hidden';

	const markEl = el.querySelector('.mark');
	const place = () => {
		const r = markEl.getBoundingClientRect();
		el.style.setProperty('--cx', `${r.left + r.width / 2}px`);
		el.style.setProperty('--cy', `${r.top + r.height / 2}px`);
	};
	place();

	const stopParticles = reduced ? () => {} : particles(el.querySelector('canvas'), markEl);
	let ended = false;
	const end = () => {
		if (ended) return;
		ended = true;
		place();
		el.classList.add('exit');
		pageReady.then(() => {
			revealed = false;
			reveal();
		});
		setTimeout(() => {
			stopParticles();
			el.remove();
			document.documentElement.style.overflow = '';
		}, 640);
	};
	const timer = setTimeout(end, reduced ? 900 : 4450);
	const skip = () => {
		clearTimeout(timer);
		end();
	};
	el.addEventListener('click', skip);
	addEventListener('keydown', skip, { once: true });
}

// ---------- particles ----------
function particles(canvas, markEl) {
	const ctx = canvas.getContext('2d');
	const dpr = Math.min(2, devicePixelRatio || 1);
	let W, H;
	const size = () => {
		W = canvas.clientWidth;
		H = canvas.clientHeight;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	size();
	addEventListener('resize', size);

	const pal = ['#8b5cff', '#a98bff', '#ff4fa3', '#ff7cbc', '#ffb547', '#ffffff'];
	const rand = (a, b) => a + Math.random() * (b - a);
	const ease = (x) => 1 - Math.pow(1 - x, 3);
	const box = () => markEl.getBoundingClientRect();
	const mobile = W < 700;

	const inflow = Array.from({ length: mobile ? 110 : 190 }, () => {
		const a0 = rand(0, Math.PI * 2);
		return { a0, spin: rand(1.6, 3.2), d0: rand(0.55, 1.1) * Math.hypot(W, H) * 0.6, delay: rand(0, 0.45), dur: rand(0.8, 1.15), c: pal[(Math.random() * pal.length) | 0], s: rand(0.8, 2.2), px: null, py: null };
	});
	const sparks = [];
	const dust = Array.from({ length: mobile ? 50 : 90 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-6, 6), vy: rand(-10, -2), s: rand(0.4, 1.4), ph: rand(0, 6.28), c: pal[(Math.random() * pal.length) | 0] }));
	let burst = false;
	let shocked = false;
	const t0 = performance.now();
	let last = t0;
	let raf;

	const frame = (now) => {
		const t = (now - t0) / 1000;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		const b = box();
		const cx = b.left + (30 / 64) * b.width;
		const cy = b.top + (34 / 64) * b.height;
		const rr = (15 / 64) * b.width;
		const sx = b.left + (46.5 / 64) * b.width;
		const sy = b.top + (17.5 / 64) * b.height;

		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = 'rgba(4,4,6,0.26)';
		ctx.fillRect(0, 0, W, H);
		ctx.globalCompositeOperation = 'lighter';

		// 1) streams spiral into the lens
		for (const p of inflow) {
			const k = Math.min(1, Math.max(0, (t - p.delay) / p.dur));
			if (k <= 0) continue;
			const e = ease(k);
			const r = p.d0 * (1 - e) + rr * e;
			const a = p.a0 + p.spin * e;
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r;
			const fade = k >= 1 ? Math.max(0, 1 - (t - p.delay - p.dur) / 0.3) : Math.min(1, k * 4);
			if (fade > 0) {
				ctx.strokeStyle = p.c;
				ctx.globalAlpha = fade * 0.9;
				ctx.lineWidth = p.s;
				ctx.beginPath();
				ctx.moveTo(p.px ?? x, p.py ?? y);
				ctx.lineTo(x, y);
				ctx.stroke();
			}
			p.px = x;
			p.py = y;
		}

		// 2) spark burst when the glint pops
		if (!burst && t > 2.28) {
			burst = true;
			for (let i = 0; i < (mobile ? 70 : 120); i++) {
				const a = rand(0, Math.PI * 2);
				const v = rand(80, 560);
				sparks.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.6, 1.4), age: 0, c: pal[(Math.random() * pal.length) | 0], s: rand(0.6, 1.8) });
			}
		}
		for (const s of sparks) {
			if (s.age > s.life) continue;
			s.age += dt;
			s.vx *= 0.94;
			s.vy = s.vy * 0.94 + 40 * dt;
			const nx = s.x + s.vx * dt;
			const ny = s.y + s.vy * dt;
			ctx.strokeStyle = s.c;
			ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
			ctx.lineWidth = s.s;
			ctx.beginPath();
			ctx.moveTo(s.x, s.y);
			ctx.lineTo(nx, ny);
			ctx.stroke();
			s.x = nx;
			s.y = ny;
		}

		// 3) ambient dust, pushed out by the shockwave
		if (t > 2.4) {
			if (!shocked && t > 4.1) {
				shocked = true;
				for (const d of dust) {
					const dx = d.x - cx;
					const dy = d.y - cy;
					const m = Math.hypot(dx, dy) || 1;
					d.vx += (dx / m) * 260;
					d.vy += (dy / m) * 260;
				}
			}
			const a = Math.min(1, (t - 2.4) / 0.8);
			for (const d of dust) {
				d.vx *= 0.985;
				d.vy *= 0.985;
				d.x += d.vx * dt;
				d.y += d.vy * dt;
				ctx.fillStyle = d.c;
				ctx.globalAlpha = a * (0.25 + 0.35 * Math.sin(t * 3 + d.ph) ** 2);
				ctx.beginPath();
				ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
		raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
	return () => {
		cancelAnimationFrame(raf);
		removeEventListener('resize', size);
	};
}
