/* আল-কুরআন: সূরা তালিকা, আরবি + বাংলা অনুবাদ, আয়াতভিত্তিক অডিও, সূরা গাইড */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const BD = '০১২৩৪৫৬৭৮৯';
const bn = v => String(v).replace(/\d/g, d => BD[d]);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = m => (window.NZ && NZ.toast ? NZ.toast(m) : alert(m));
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const V = 6;
const DL = window.NZDL;                 // offline.js (loaded first): reciters, storage, download queue
const RECITERS = DL.RECITERS;
let reciter = store.get('nz-reciter', 'ar.alafasy'); if (!RECITERS.some(r => r[0] === reciter)) reciter = 'ar.alafasy';
const rc = () => RECITERS.find(r => r[0] === reciter);
const audioUrl = (n, a) => DL.url(reciter, n, a);
function setReciter(id) {
  if (!RECITERS.some(r => r[0] === id) || id === reciter) return;
  reciter = id; store.set('nz-reciter', reciter);
  if ($('#qReciter')) $('#qReciter').value = id;
  updateSaveBtn(); if (IDX && $('#qList').children.length) renderList();
  if (pl.n) play();
}

let IDX = null, cur = null;            // cur = {n, g, a:[[ar,bn,sajda]]}
const surahCache = {};
async function index() {
  if (!IDX) IDX = (await (await fetch(`data/quran/index.json?v=${V}`)).json()).surahs;
  return IDX;
}
async function surah(n) {
  if (!surahCache[n]) surahCache[n] = (await (await fetch(`data/quran/${n}.json?v=${V}`)).json());
  return surahCache[n];
}
const meta = n => IDX[n - 1];
const norm = s => String(s).toLowerCase().replace(/[\s\-’'`]/g, '').replace(/[\u064B-\u065F\u0670\u0671]/g, m => m === '\u0671' ? '\u0627' : '').replace(/ী/g, 'ি').replace(/ূ/g, 'ু').replace(/^(আল|আন|আত|আর|আস|আশ|আয|আদ|al|an|at|ar|as|ash|az|ad)/, '').replace(/^ال/, '');

// ---------- list ----------
function renderList() {
  const q = norm($('#qSearch').value.trim());
  const qd = $('#qSearch').value.trim().replace(/[০-৯]/g, d => BD.indexOf(d));
  const rows = IDX.filter(s => !q || String(s.n) === qd || norm(s.bn).includes(q) || norm(s.ar).includes(q) || norm(s.en).includes(q) || norm(s.m).includes(q));
  $('#qList').innerHTML = rows.map(s => `<button class="s-row" data-n="${s.n}"><span class="s-no">${bn(s.n)}</span><span class="s-name"><b>${esc(s.bn)}</b><small>${esc(s.m)} · ${s.p} · ${bn(s.c)} আয়াত</small></span>${DL.isSaved(reciter, s.n) ? '<span class="off-b" title="অফলাইনে আছে">অফলাইন</span>' : ''}<span class="s-ar" lang="ar">${esc(s.ar)}</span></button>`).join('') || '<p class="empty">কোনো সূরা পাওয়া যায়নি</p>';
}
function renderResume() {
  const l = store.get('nz-qlast', null), el = $('#qResume');
  if (!l || !IDX) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<span>📖 শেষ পড়া: <b>সূরা ${esc(meta(l.n).bn)}</b>, আয়াত ${bn(l.a)}</span><button class="chip on" data-resume>চালিয়ে যান ›</button>`;
}
async function initQuran() {
  await index();
  if (!$('#qReciter').options.length) {
    $('#qReciter').innerHTML = RECITERS.map(r => `<option value="${r[0]}">${r[2]}</option>`).join('');
    $('#qReciter').value = reciter;
  }
  if (!$('#qList').children.length) renderList();
  renderResume();
}

// ---------- reader ----------
let io = null;
async function openSurah(n, ayah = 1, {scroll = true} = {}) {
  await index();
  const m = meta(n); cur = await surah(n);
  $('#qBrowse').classList.add('hidden'); $('#qReader').classList.remove('hidden');
  $('#rTitle').innerHTML = `সূরা ${esc(m.bn)} <span lang="ar">${esc(m.ar)}</span>`;
  $('#rMeta').textContent = `${m.m} · ${m.p} · ${bn(m.c)} আয়াত · সূরা নং ${bn(n)}`;
  $('#rBism').classList.toggle('hidden', n === 1 || n === 9);
  $('#rPrev').disabled = n === 1; $('#rNext').disabled = n === 114;
  $('#rAyahs').innerHTML = cur.a.map((x, i) => `<article class="ayah" id="ay-${i + 1}" data-a="${i + 1}">
    <div class="ay-h"><span class="ay-no">${bn(n)}:${bn(i + 1)}</span>${x[2] ? '<span class="tag">সিজদা</span>' : ''}<button class="ay-play" data-a="${i + 1}" aria-label="এই আয়াত শুনুন">▶</button></div>
    <p class="ay-ar" lang="ar" dir="rtl">${esc(x[0])} <span class="ay-end">﴿${(i + 1).toLocaleString('ar-EG')}﴾</span></p>
    <p class="ay-bn">${esc(x[1])}</p></article>`).join('');
  updateSaveBtn();
  store.set('nz-qlast', {n, a: ayah});
  const h = `#quran/${n}${ayah > 1 ? ':' + ayah : ''}`;
  const d = (history.state && history.state.d) || 0;
  if (/^#quran\//.test(location.hash)) history.replaceState({r: 1, d}, '', h); else history.pushState({r: 1, d: d + 1}, '', h);   // Back button closes the reader
  if (io) io.disconnect();
  io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && cur && cur.n === n && !player.playing()) store.set('nz-qlast', {n, a: +e.target.dataset.a}); }, {rootMargin: '-40% 0px -55% 0px'});
  document.querySelectorAll('.ayah').forEach(a => io.observe(a));
  if (scroll) (ayah > 1 ? $('#ay-' + ayah) : $('#qReader')).scrollIntoView({block: ayah > 1 ? 'center' : 'start'});
  highlight();
}
function closeReader(fromPop) {
  $('#qReader').classList.add('hidden'); $('#qBrowse').classList.remove('hidden');
  if (!fromPop) { if (history.state && history.state.r && history.state.d > 0) history.back(); else history.replaceState({d: (history.state && history.state.d) || 0}, '', '#quran'); }
  if (window.NZ && NZ.syncBack) NZ.syncBack();
  renderResume();
}
addEventListener('popstate', () => {
  const m = location.hash.match(/^#quran\/(\d+)(?::(\d+))?/), open = !$('#qReader').classList.contains('hidden');
  if (!m && open) closeReader(true);
  else if (m && (!open || !cur || cur.n !== +m[1])) openSurah(+m[1], +(m[2] || 1));     // forward / back into a reader entry
});

// ---------- player ----------
const au = new Audio(); au.preload = 'auto';
const pl = {n: 0, from: 1, to: 0, a: 0, g: 0};
const player = {
  playing: () => !au.paused,
  async start(n, from = 1, to = 0) {
    await index(); const s = await surah(n);
    Object.assign(pl, {n, from, to: to || s.a.length, a: from, g: s.g});
    play();
  },
};
let blobUrl = null;
async function srcFor(n, a) {        // downloaded audio plays from the phone (Filesystem in the app, Cache API in the browser)
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
  const local = await DL.backend.src(reciter, n, a);
  if (local) { if (local.startsWith('blob:')) blobUrl = local; return local; }
  return audioUrl(n, a);
}
async function play() {
  const want = pl.n + ':' + pl.a;
  const src = await srcFor(pl.n, pl.a);
  if (want !== pl.n + ':' + pl.a) return;
  au.src = src;
  au.play().catch(() => toast('অডিও চালানো যায়নি — ইন্টারনেট সংযোগ দেখুন'));
  store.set('nz-qlast', {n: pl.n, a: pl.a});
  showBar(); highlight(true);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({title: `সূরা ${meta(pl.n).bn} — আয়াত ${bn(pl.a)}`, artist: rc()[2], album: 'আল-কুরআন', artwork: [{src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png'}]});
  }
}
function step(d) {
  const na = pl.a + d;
  if (na < pl.from || na > pl.to) {
    if (d > 0 && pl.to === IDX[pl.n - 1].c && store.get('nz-qauto', false) && pl.n < 114) return player.start(pl.n + 1);
    return stop(d > 0);
  }
  pl.a = na; play();
}
function stop(ended) {
  au.pause(); $('#qBar').classList.add('hidden'); pl.n = 0; highlight();
  document.body.classList.remove('has-qbar');
  if (ended) toast('তিলাওয়াত শেষ');
}
au.addEventListener('ended', () => step(1));
au.addEventListener('error', () => { if (pl.n) { toast('এই আয়াতের অডিও পাওয়া যায়নি'); setTimeout(() => step(1), 800); } });
au.addEventListener('play', syncBar); au.addEventListener('pause', syncBar);
function syncBar() { $('#qbPlay').textContent = au.paused ? '▶' : '⏸'; document.querySelectorAll('.r-playall').forEach(b => b.textContent = (!au.paused && cur && pl.n === cur.n) ? '⏸ বিরতি' : '▶ পুরো সূরা শুনুন'); }
function showBar() {
  $('#qBar').classList.remove('hidden'); document.body.classList.add('has-qbar');
  $('#qbName').textContent = `সূরা ${meta(pl.n).bn}`;
  $('#qbSub').textContent = `আয়াত ${bn(pl.a)} / ${bn(pl.to)} · ${rc()[2]}`;
}
function highlight(scroll) {
  document.querySelectorAll('.ayah.now').forEach(x => x.classList.remove('now'));
  if (!cur || pl.n !== cur.n || !pl.n) return;
  const el = $('#ay-' + pl.a); if (!el) return;
  el.classList.add('now');
  if (scroll && !$('#qReader').classList.contains('hidden') && !$('#tab-quran').classList.contains('hidden')) el.scrollIntoView({block: 'center', behavior: 'smooth'});
}
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
  navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
}

// ---------- offline audio (download manager lives in offline.js) ----------
function updateSaveBtn() {
  const b = $('#rSave'); if (!b || !cur) return;
  const st = DL.state(reciter, cur.n);
  b.textContent = st.saved ? `✅ অফলাইনে আছে (${st.mb(st.bytes)}) · মুছুন` : st.queued ? (st.pct != null ? `⬇️ ডাউনলোড হচ্ছে… ${bn(st.pct)}%` : st.paused ? '⏸ ডাউনলোড বিরতিতে — চালু করুন' : '⏳ ডাউনলোডের অপেক্ষায়') : `⬇️ অডিও অফলাইনে রাখুন (≈ ${st.mb(st.bytes)})`;
  b.dataset.saved = st.saved ? '1' : '';
}
async function saveAudio() { if (cur) { await DL.toggle(reciter, cur.n); updateSaveBtn(); } }
setInterval(() => { if (cur && !$('#qReader').classList.contains('hidden') && DL.queue) updateSaveBtn(); }, 700);
document.addEventListener('nz-dl', e => { updateSaveBtn(); if (IDX && $('#qList').children.length) renderList(); });
async function saveAllText() {
  const b = $('#qSaveText'); b.disabled = true; let d = 0;
  await index();
  for (let n = 1; n <= 114; n += 6) {
    await Promise.all(Array.from({length: Math.min(6, 115 - n)}, (_, k) => surah(n + k).then(() => { d++; b.textContent = `📥 ${bn(d)}/১১৪`; }).catch(() => {})));
  }
  b.disabled = false; b.textContent = d === 114 ? '✅ পুরো কুরআনের টেক্সট অফলাইনে আছে' : '📥 আবার চেষ্টা করুন';
  store.set('nz-qtext', d === 114);
}

// ---------- surah guide ----------
const GL = {must: 'প্রতিটি সালাত', fajr: 'ফজর', jumuah: 'জুমুআ ও ঈদ', maghrib: 'মাগরিব', isha: 'এশা', witr: 'বিতর', after: 'সালাতের পর', night: 'রাতে / ঘুমানোর আগে', other: 'অন্যান্য'};
const BL = 'কখগঘঙচছজঝঞটঠডঢণতথদধন';
function refNum(r) {
  if (r.c !== 'muslim') return bn(r.n);
  const [a, b] = String(r.an).split('.'); return bn(a) + (b && +b ? BL[(+b - 1) % BL.length] : '');
}
function refLink(r) {
  if (r.c === 'muslim') { const [a, b] = String(r.an).split('.'); return `https://sunnah.com/muslim:${a}${b && +b ? String.fromCharCode(96 + +b) : ''}`; }
  return `https://sunnah.com/${r.c}:${r.n}`;
}
const gradeText = gs => gs.map(g => `${esc(g.name)}: ${esc(g.grade)}`).join(' · ');
function surahChip(x) {
  const [n, a, b] = x, m = meta(n);
  const lbl = a ? `সূরা ${m.bn} ${bn(a)}${b !== a ? '–' + bn(b) : ''}` : `সূরা ${m.bn}`;
  return `<button class="chip play-s" data-n="${n}" data-from="${a || 1}" data-to="${b || 0}">▶ ${esc(lbl)}</button>`;
}
let guideDone = false;
async function initGuide() {
  if (guideDone) return; await index();
  const G = await (await fetch(`data/surah-guide.json?v=${V}`)).json();
  const items = G.items.filter(i => i.g !== 'must');
  let html = '', last = '';
  for (const it of items) {
    if (it.g !== last) { html += `<h3 class="g-h">${GL[it.g] || it.g}</h3>`; last = it.g; }
    html += `<article class="g-item"><div class="g-top"><b>${esc(it.title)}</b><small class="muted">${esc(it.when)}</small></div>
      <div class="chips">${it.surahs.map(surahChip).join('')}</div>
      ${it.refs.map(r => `<details class="g-ref"><summary><span class="tag">${esc(r.cn)} ${refNum(r)}</span>${r.grades && r.grades.length ? `<span class="grade">${gradeText(r.grades)}</span>` : ''}<span class="muted small">হাদিস পড়ুন</span></summary>
        <p class="bn">${esc(r.bn)}</p><p class="ar" lang="ar" dir="rtl">${esc(r.ar)}</p><a href="${refLink(r)}" target="_blank" rel="noopener">sunnah.com-এ দেখুন ↗</a></details>`).join('')}
    </article>`;
  }
  $('#gList').innerHTML = html;
  const must = G.items.find(i => i.g === 'must');
  if (must) $('#gMustRef').innerHTML = must.refs.map(r => `<details class="g-ref"><summary><span class="tag">${esc(r.cn)} ${refNum(r)}</span><span class="muted small">হাদিস পড়ুন</span></summary><p class="bn">${esc(r.bn)}</p><p class="ar" lang="ar" dir="rtl">${esc(r.ar)}</p><a href="${refLink(r)}" target="_blank" rel="noopener">sunnah.com-এ দেখুন ↗</a></details>`).join('') + `<div class="chips">${surahChip([1])}</div>`;
  $('#gShort').innerHTML = IDX.slice(104).map(s => `<div class="short"><button class="sp" data-n="${s.n}" aria-label="সূরা ${esc(s.bn)} শুনুন">▶</button><span><b>${bn(s.n)}. ${esc(s.bn)}</b><small>${bn(s.c)} আয়াত · ${esc(s.m)}</small></span><span class="s-ar" lang="ar">${esc(s.ar)}</span><button class="chip" data-open="${s.n}">পড়ুন</button></div>`).join('');
  guideDone = true;
}

// ---------- events ----------
document.addEventListener('nz-tab', e => {
  if (e.detail === 'quran') initQuran().catch(() => $('#qList').innerHTML = '<p class="empty">সূরার তালিকা লোড করা যায়নি</p>');
  if (e.detail === 'guide') initGuide().catch(() => $('#gList').innerHTML = '<p class="empty">গাইড লোড করা যায়নি</p>');
});
let qt; document.addEventListener('input', e => { if (e.target.id === 'qSearch') { clearTimeout(qt); qt = setTimeout(renderList, 150); } });
document.addEventListener('change', e => {
  if (e.target.id === 'qReciter') { setReciter(e.target.value); toast('ক্বারী: ' + rc()[2]); }
  if (e.target.id === 'qAuto') store.set('nz-qauto', e.target.checked);
});
function gotoQuran(n, from, to, autoplay) {
  document.querySelector('#tabs [data-tab=quran]').click();
  openSurah(n, from || 1).then(() => { if (autoplay) player.start(n, from || 1, to || 0); });
}
document.addEventListener('click', e => {
  const t = e.target;
  const row = t.closest('.s-row'); if (row) return openSurah(+row.dataset.n);
  if (t.closest('[data-resume]')) { const l = store.get('nz-qlast', {n: 1, a: 1}); return openSurah(l.n, l.a); }
  if (t.closest('#rBack')) return closeReader();
  if (t.closest('#rPrev') && cur) return openSurah(cur.n - 1);
  if (t.closest('#rNext') && cur) return openSurah(cur.n + 1);
  if (t.closest('#rSave')) return saveAudio();
  if (t.closest('#qSaveText')) return saveAllText();
  if (t.closest('.r-playall') && cur) { if (pl.n === cur.n) { au.paused ? au.play() : au.pause(); return; } const l = store.get('nz-qlast', null); return player.start(cur.n, 1); }
  const ap = t.closest('.ay-play'); if (ap && cur) { const a = +ap.dataset.a; return player.start(cur.n, a, a); }
  const ar = t.closest('.ayah'); if (ar && cur && !t.closest('button') && pl.n === cur.n) { pl.a = +ar.dataset.a; return play(); }
  if (t.closest('#qbPlay')) { au.paused ? au.play() : au.pause(); return; }
  if (t.closest('#qbNext')) return step(1);
  if (t.closest('#qbPrev')) return step(-1);
  if (t.closest('#qbStop')) return stop(false);
  if (t.closest('#qbTitle') && pl.n) return gotoQuran(pl.n, pl.a);
  const ps = t.closest('.play-s'); if (ps) return gotoQuran(+ps.dataset.n, +ps.dataset.from, +ps.dataset.to, true);
  const sp = t.closest('.sp'); if (sp) return gotoQuran(+sp.dataset.n, 1, 0, true);
  const op = t.closest('[data-open]'); if (op) return gotoQuran(+op.dataset.open);
});
$('#qAuto') && ($('#qAuto').checked = store.get('nz-qauto', false));
if (store.get('nz-qtext', false) && $('#qSaveText')) $('#qSaveText').textContent = '✅ পুরো কুরআনের টেক্সট অফলাইনে আছে';
window.NZQ = { openSurah, player, index, closeReader, setReciter, reciter: () => reciter };
// deep link: #quran/18 or #quran/2:255
const m = location.hash.match(/^#quran\/(\d+)(?::(\d+))?/);
if (m) document.addEventListener('DOMContentLoaded', () => setTimeout(() => openSurah(Math.min(114, Math.max(1, +m[1])), +(m[2] || 1)), 0));
})();
