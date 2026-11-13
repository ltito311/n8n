import { $, api, fmt, ago, esc, icons, toast, topbar, store, requireOwner, me } from './common.js';
import { hold } from './fx.js';

$('#top').innerHTML = topbar(`<a class="btn btn-primary" href="/record">${icons.plus} New recording</a>`);
$('#search').innerHTML = `${icons.search}<input class="input" id="q" placeholder="Search titles, summaries, transcripts…" />`;

const list = $('#list');
const sortSel = $('#sort');
sortSel.value = store.get('sort', 'new');

let videos = [];
let q = '';

api('/config').then((c) => {
	$('#aiPill').innerHTML = c.ai
		? `<span class="pill ai">${icons.sparkle.replace('<svg', '<svg width="12" height="12"')} Groq · ${esc(c.model)}</span>`
		: `<span class="pill warn"><span class="dot"></span>AI off — add GROQ_API_KEY</span>`;
});

async function load() {
	videos = await api(`/videos${q ? `?q=${encodeURIComponent(q)}` : ''}`);
	render();
}

function render() {
	const s = sortSel.value;
	const sorted = [...videos].sort((a, b) =>
		s === 'old' ? a.createdAt - b.createdAt : s === 'views' ? b.views - a.views : s === 'long' ? b.duration - a.duration : b.createdAt - a.createdAt,
	);
	const total = videos.reduce((n, v) => n + (v.duration || 0), 0);
	$('#stats').innerHTML = `<span><b>${videos.length}</b>videos</span><span><b>${fmt(total)}</b>recorded</span><span><b>${videos.reduce((n, v) => n + (v.views || 0), 0)}</b>views</span>`;

	if (!sorted.length) {
		list.style.display = 'block';
		list.innerHTML = q
			? `<div class="empty"><h2>Nothing matches “${esc(q)}”</h2><p>Search looks through titles, AI summaries and every word spoken.</p></div>`
			: `<div class="empty"><div class="orb"></div><h2>Record your first video</h2><p>Screen, camera, or both. Share a link the second you stop.</p><a class="btn btn-primary btn-lg" href="/record">${icons.plus} Start recording</a></div>`;
		return;
	}
	list.style.display = '';
	list.innerHTML = sorted
		.map(
			(v, i) => `
		<a class="card" href="/v/${v.id}" style="animation-delay:${Math.min(i, 12) * 35}ms">
			<div class="thumb">
				${v.thumbUrl ? `<img src="${v.thumbUrl}" alt="" loading="lazy" />` : `<div class="noimg">${icons.cam.replace('<svg', '<svg width="32" height="32"')}</div>`}
				<div class="play"><span>${icons.play.replace('<svg', '<svg width="22" height="22" style="margin-left:3px"')}</span></div>
				<span class="dur">${fmt(v.duration)}</span>
			</div>
			<div class="menu"><button class="btn btn-sm btn-icon" data-copy="${v.id}" title="Copy link">${icons.link}</button></div>
			<div class="card-body">
				<h3 class="card-title">${esc(v.title)}</h3>
				<p class="card-sum">${
					v.ai?.summary
						? esc(v.ai.summary)
						: v.ai?.status === 'processing' || v.ai?.status === 'queued' || v.ai?.status === 'transcribing'
							? '<span class="spin"></span> AI is writing the summary…'
							: '<span class="faint">No summary</span>'
				}</p>
				<div class="card-meta">
					<span>${ago(v.createdAt)}</span>
					<span>${icons.eye}${v.views}</span>
					<span>${icons.chat}${v.commentCount}</span>
					${v.ai?.tags?.[0] ? `<span class="pill" style="height:20px;font-size:11px">#${esc(v.ai.tags[0])}</span>` : ''}
				</div>
			</div>
		</a>`,
		)
		.join('');
}

list.addEventListener('click', (e) => {
	const b = e.target.closest('[data-copy]');
	if (!b) return;
	e.preventDefault();
	navigator.clipboard.writeText(`${location.origin}/v/${b.dataset.copy}`);
	toast('Link copied');
});

let t;
$('#q').addEventListener('input', (e) => {
	clearTimeout(t);
	t = setTimeout(() => {
		q = e.target.value.trim();
		load();
	}, 200);
});
sortSel.addEventListener('change', () => {
	store.set('sort', sortSel.value);
	render();
});
document.addEventListener('keydown', (e) => {
	if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
		e.preventDefault();
		$('#q').focus();
	}
});

let loaded = false;
list.innerHTML = Array.from({ length: 6 }, () => `<div class="card"><div class="thumb skeleton" style="border-radius:0"></div><div class="card-body"><div class="skeleton" style="height:16px;width:75%;margin-bottom:10px"></div><div class="skeleton" style="height:12px;margin-bottom:6px"></div><div class="skeleton" style="height:12px;width:60%"></div></div></div>`).join('');
hold(me().then((m) => m.owner && load().then(() => (loaded = true))));
await requireOwner();
if (!loaded) load();
// refresh while AI is still working on something
setInterval(() => {
	if (videos.some((v) => ['queued', 'processing', 'transcribing'].includes(v.ai?.status))) load();
}, 4000);
