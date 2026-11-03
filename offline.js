/* অফলাইন ডাউনলোড: সূরার অডিও (ক্বারী অনুযায়ী) ফোনে স্থায়ীভাবে রাখা — বিরতি/চালু/বাতিল, অ্যাপ বন্ধ হলেও পরে আবার চালু */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const BD = '০১২৩৪৫৬৭৮৯', bn = v => String(v).replace(/\d/g, d => BD[d]);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = m => (window.NZ && NZ.toast ? NZ.toast(m) : alert(m));
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const V = 5;
const RECITERS = [           // everyayah.com folders (per-ayah MP3, CORS enabled so they can be saved offline)
  ['ar.alafasy', 'Alafasy_128kbps', 'মিশারি রাশিদ আল-আফাসি'],
  ['ar.husary', 'Husary_128kbps', 'মাহমুদ খলীল আল-হুসারী'],
  ['ar.minshawi', 'Minshawy_Murattal_128kbps', 'মুহাম্মাদ সিদ্দীক আল-মিনশাবী'],
  ['ar.mahermuaiqly', 'MaherAlMuaiqly128kbps', 'মাহের আল-মুআইকিলী'],
  ['ar.abdurrahmaansudais', 'Abdurrahmaan_As-Sudais_64kbps', 'আবদুর রহমান আস-সুদাইস'],
  ['ar.abdulbasitmurattal', 'Abdul_Basit_Murattal_64kbps', 'আবদুল বাসিত আবদুস সামাদ (মুরাত্তাল)'],
];
const rec = id => RECITERS.find(r => r[0] === id) || RECITERS[0];
const p3 = x => String(x).padStart(3, '0');
const url = (rid, n, a) => `https://everyayah.com/data/${rec(rid)[1]}/${p3(n)}${p3(a)}.mp3`;
const AUDIO_CACHE = 'namaz-quran-audio';
const mb = b => b >= 1e9 ? `${bn((b / 1e9).toFixed(2))} GB` : `${bn(b >= 1e7 ? Math.round(b / 1e6) : (b / 1e6).toFixed(1))} MB`;

// ---------- storage backend ----------
// Android app: Capacitor Filesystem, app-private "Data" directory (never evicted by the OS; removed only on uninstall / "Clear data").
// Browser: Cache API + navigator.storage.persist().
const C = window.Capacitor;
const NATIVE = !!(C && C.isNativePlatform && C.isNativePlatform());
const FS = NATIVE && C.isPluginAvailable && C.isPluginAvailable('Filesystem') ? (C.Plugins.Filesystem || C.registerPlugin('Filesystem')) : null;
const DIR = 'DATA';
const fpath = (rid, n, a) => `quran/${rec(rid)[1]}/${p3(n)}/${p3(a)}.mp3`;
let cacheP = null; const cache = () => cacheP || (cacheP = ('caches' in window ? caches.open(AUDIO_CACHE) : Promise.reject(new Error('no-cache'))));
const b64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
const backend = {
  kind: FS ? 'fs' : ('caches' in window ? 'cache' : 'none'),
  async size(rid, n, a) {            // bytes if saved, else 0
    if (FS) { try { const s = await FS.stat({path: fpath(rid, n, a), directory: DIR}); return +s.size || 1; } catch {} }
    try { const r = await (await cache()).match(url(rid, n, a)); if (r) return +(r.headers.get('content-length') || 0) || 1; } catch {}
    return 0;
  },
  async put(rid, n, a, blob) {
    if (FS) return FS.writeFile({path: fpath(rid, n, a), directory: DIR, data: await b64(blob), recursive: true});
    return (await cache()).put(url(rid, n, a), new Response(blob, {headers: {'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size)}}));
  },
  async src(rid, n, a) {             // local playable URL or null
    if (FS) { try { await FS.stat({path: fpath(rid, n, a), directory: DIR}); const {uri} = await FS.getUri({path: fpath(rid, n, a), directory: DIR}); return C.convertFileSrc(uri); } catch {} }
    try { const r = await (await cache()).match(url(rid, n, a)); if (r) return URL.createObjectURL(await r.blob()); } catch {}
    return null;
  },
  async delSurah(rid, n, count) {
    if (FS) { try { await FS.rmdir({path: `quran/${rec(rid)[1]}/${p3(n)}`, directory: DIR, recursive: true}); } catch {} }
    try { const c = await cache(); await Promise.all(Array.from({length: count}, (_, i) => c.delete(url(rid, n, i + 1)))); } catch {}
  },
};
let persisted = null;
async function persist() {
  if (FS) return (persisted = true);
  try { if (navigator.storage && navigator.storage.persist) persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch {}
  return persisted;
}

// ---------- data ----------
let IDX = null, SIZES = null;
async function data() {
  if (!IDX) IDX = (await (await fetch(`data/quran/index.json?v=${V}`)).json()).surahs;
  if (!SIZES) { try { SIZES = (await (await fetch(`data/quran/sizes.json?v=${V}`)).json()).sizes; } catch { SIZES = {}; } }
}
const est = (rid, n) => (SIZES && SIZES[rid] && SIZES[rid][n - 1]) || (IDX ? IDX[n - 1].c * 150000 : 0);
// saved = {"ar.alafasy:36": bytes}; migrate v4's {"ar.alafasy:36": 1}
let saved = store.get('nz-dl', null);
if (!saved) { saved = {}; const old = store.get('nz-qsaved', {}); for (const k in old) saved[k] = 0; store.set('nz-dl', saved); }
const key = (rid, n) => `${rid}:${n}`;
const isSaved = (rid, n) => key(rid, n) in saved;
const savedBytes = (rid, n) => saved[key(rid, n)] || est(rid, n);
const setSaved = (rid, n, b) => { saved[key(rid, n)] = b; store.set('nz-dl', saved); };
const unSaved = (rid, n) => { delete saved[key(rid, n)]; store.set('nz-dl', saved); };

// ---------- queue / worker ----------
// q = {items: [[rid, n]], total: ayahs, done: ayahs, paused, err}; persisted so it resumes after an app restart
let q = store.get('nz-dlq', null);
const saveQ = () => store.set('nz-dlq', q && q.items.length ? q : null);
let running = false, ctl = null, cur = null;   // cur = {rid, n, d, c}
const ayahCount = n => IDX[n - 1].c;
function enqueue(list) {
  list = list.filter(([rid, n]) => !isSaved(rid, n) && !(q && q.items.some(x => x[0] === rid && x[1] === n)));
  if (!list.length) return false;
  if (!q) q = {items: [], total: 0, done: 0, paused: false};
  q.items.push(...list); q.total += list.reduce((s, x) => s + ayahCount(x[1]), 0); q.paused = false; q.err = '';
  saveQ(); persist(); run(); return true;
}
async function fetchAyah(rid, n, a, signal) {
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url(rid, n, a), {mode: 'cors', signal});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob(); await backend.put(rid, n, a, blob); return blob.size;
    } catch (e) { if (signal.aborted || t >= 2) throw e; await new Promise(ok => setTimeout(ok, 1200 * (t + 1))); }
  }
}
async function run() {
  if (running || !q || q.paused || !q.items.length) { render(); return; }
  if (navigator.onLine === false) { q.paused = true; q.err = 'ইন্টারনেট সংযোগ নেই'; saveQ(); render(); return; }
  running = true; await data();
  try {
    while (q && !q.paused && q.items.length) {
      const [rid, n] = q.items[0], c = ayahCount(n);
      const ac = ctl = new AbortController(), sig = ac.signal, me = cur = {rid, n, d: 0, c};
      let bytes = 0, next = 1; q.cd = 0; render();
      const worker = async () => {
        while (next <= c && !sig.aborted) {
          const a = next++;
          let b = await backend.size(rid, n, a);           // already saved (earlier run / v4) -> skip
          if (!b) b = await fetchAyah(rid, n, a, sig);
          if (sig.aborted) return;
          bytes += b; me.d++; if (q) q.cd = me.d; tick();
        }
      };
      try { await Promise.all([worker(), worker(), worker(), worker()]); }
      catch (e) {
        if (sig.aborted) break;                              // paused / cancelled
        ac.abort();                                          // stop the other workers
        q.paused = true; q.err = navigator.onLine === false ? 'ইন্টারনেট সংযোগ নেই' : 'কিছু ফাইল নামানো যায়নি'; saveQ(); toast('ডাউনলোড থেমে গেছে — ' + q.err); break;
      }
      if (sig.aborted || !q) break;
      q.done += c; q.cd = 0;
      if (ctl.signal.aborted) break;
      setSaved(rid, n, bytes);
      q.items.shift(); saveQ(); changed(rid, n);
    }
  } finally {
    running = false; cur = null; ctl = null;
    if (q && q.items.length && !q.paused) setTimeout(run, 0);          // resumed while the old loop was winding down
    if (q && !q.items.length) { q = null; saveQ(); toast('ডাউনলোড সম্পন্ন ✅'); }
    render();
  }
}
function pause() { if (!q) return; q.paused = true; saveQ(); if (ctl) ctl.abort(); render(); }
function resume() { if (!q) return; q.paused = false; q.err = ''; saveQ(); run(); }
async function cancel() {
  if (!q) return;
  const part = cur; if (ctl) ctl.abort();
  q = null; saveQ();
  if (part && !isSaved(part.rid, part.n)) await backend.delSurah(part.rid, part.n, part.c);   // drop the half-downloaded surah
  render(); toast('ডাউনলোড বাতিল');
}
async function remove(rid, n) {
  await data();
  if (q) { const i = q.items.findIndex(x => x[0] === rid && x[1] === n); if (i === 0 && running) { toast('এই সূরাটি এখন ডাউনলোড হচ্ছে'); return; } if (i > 0) { q.items.splice(i, 1); q.total -= ayahCount(n); saveQ(); } }
  await backend.delSurah(rid, n, ayahCount(n)); unSaved(rid, n); changed(rid, n); render();
}
function changed(rid, n) { document.dispatchEvent(new CustomEvent('nz-dl', {detail: {rid, n}})); }

// ---------- UI ----------
const curRid = () => (window.NZQ && NZQ.reciter && NZQ.reciter()) || store.get('nz-reciter', 'ar.alafasy');
let filt = '', onlySaved = false, rq = 0;
function tick() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; renderProg(); renderRowState(); }); }
function renderProg() {
  const box = $('#dlProg'); if (!box) return;
  if (!q) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const pct = q.total ? Math.min(100, Math.floor((q.done + (q.cd || 0)) / q.total * 100)) : 0;
  const head = q.items[0]; const m = IDX && head ? IDX[head[1] - 1] : null;
  $('#dlNow').textContent = q.paused ? (q.err ? `⚠️ থেমে আছে — ${q.err}` : '⏸ বিরতিতে আছে') : (m ? `⬇️ সূরা ${m.bn} (${bn(q.cd || 0)}/${bn(m.c)} আয়াত)` : '⬇️ শুরু হচ্ছে…');
  $('#dlPct').textContent = `${bn(pct)}% · বাকি ${bn(q.items.length)}টি সূরা${head ? ' · ' + rec(head[0])[2] : ''}`;
  $('#dlBar').style.width = pct + '%';
  $('#dlPause').textContent = q.paused ? '▶ চালু করুন' : '⏸ বিরতি';
}
function rowBtn(rid, n) {
  if (isSaved(rid, n)) return `<button class="chip dl-del" data-del="${n}" aria-label="মুছুন">🗑</button>`;
  if (q && q.items.some(x => x[0] === rid && x[1] === n)) {
    const now = cur && cur.rid === rid && cur.n === n;
    return `<span class="chip dl-q">${now ? bn(Math.floor(cur.d / cur.c * 100)) + '%' : (q.paused ? '⏸' : '⏳')}</span>`;
  }
  return `<button class="chip on dl-get" data-get="${n}">⬇️</button>`;
}
function rowHTML(rid, s) { return `<span class="s-no">${bn(s.n)}</span><span class="s-name"><b>${esc(s.bn)}</b><small>${bn(s.c)} আয়াত · ${isSaved(rid, s.n) ? '✅ অফলাইনে · ' + mb(savedBytes(rid, s.n)) : '≈ ' + mb(est(rid, s.n))}</small></span><span class="dl-act">${rowBtn(rid, s.n)}</span>`; }
function updateRow(n) {
  const rid = $('#dlReciter').value, r = document.querySelector(`#dlList .dl-row[data-n="${n}"]`); if (!r || !IDX) return;
  r.classList.toggle('got', isSaved(rid, n)); r.innerHTML = rowHTML(rid, IDX[n - 1]);
}
function renderRowState() {
  const rid = $('#dlReciter') && $('#dlReciter').value; if (!rid) return;
  document.querySelectorAll('#dlList .dl-row').forEach(r => { const n = +r.dataset.n; const s = r.querySelector('.dl-act'); const h = rowBtn(rid, n); if (s.innerHTML !== h) s.innerHTML = h; });
}
async function renderSummary() {
  const rid = $('#dlReciter').value;
  let cnt = 0, bytes = 0, all = 0, allBytes = 0;
  for (let n = 1; n <= 114; n++) { all += est(rid, n); if (isSaved(rid, n)) { cnt++; bytes += savedBytes(rid, n); } }
  for (const k in saved) { const [r, n] = k.split(':'); allBytes += saved[k] || est(r, +n); }
  $('#dlSum').innerHTML = `<b>${esc(rec(rid)[2])}</b>: ${bn(cnt)}/১১৪ সূরা অফলাইনে · ${mb(bytes)}<br><span class="muted small">পুরো কুরআন এই ক্বারীর কণ্ঠে ≈ ${mb(all)} · সব ক্বারী মিলিয়ে ডাউনলোড: ${mb(allBytes)}</span>`;
  let used = '';
  if (!FS && navigator.storage && navigator.storage.estimate) { try { const e = await navigator.storage.estimate(); used = ` · ব্রাউজার স্টোরেজ ব্যবহৃত ${mb(e.usage || 0)} / ${mb(e.quota || 0)}`; } catch {} }
  const p = FS ? 'অ্যাপের নিজস্ব স্টোরেজে রাখা হয় — ফোন নিজে থেকে মুছবে না (অ্যাপ আনইনস্টল বা “Clear data” করলে মুছে যাবে)।'
    : persisted ? 'স্থায়ী স্টোরেজ চালু — ব্রাউজার নিজে থেকে মুছবে না।' : 'ব্রাউজার জায়গা কম পড়লে ফাইল মুছে দিতে পারে — অ্যাপ হিসেবে ইনস্টল করলে বা Android অ্যাপে বেশি নিরাপদ।';
  $('#dlPersist').textContent = p + used;
  $('#dlAll').disabled = cnt === 114;
  $('#dlDelAll').disabled = !cnt;
}
function renderList() {
  const rid = $('#dlReciter').value;
  const f = filt.trim().toLowerCase(), fd = f.replace(/[০-৯]/g, d => BD.indexOf(d));
  const rows = IDX.filter(s => (!onlySaved || isSaved(rid, s.n)) && (!f || String(s.n) === fd || s.bn.toLowerCase().includes(f) || s.en.toLowerCase().includes(f) || s.ar.includes(f)));
  $('#dlList').innerHTML = rows.map(s => `<div class="dl-row${isSaved(rid, s.n) ? ' got' : ''}" data-n="${s.n}">${rowHTML(rid, s)}</div>`).join('') || '<p class="empty">কিছু পাওয়া যায়নি</p>';
}
async function render() {
  if (!$('#tab-dl') || $('#tab-dl').classList.contains('hidden')) { renderProg(); return; }
  await data();
  const sel = $('#dlReciter');
  if (!sel.options.length) sel.innerHTML = RECITERS.map(r => `<option value="${r[0]}">${r[2]}</option>`).join('');
  if (document.activeElement !== sel) sel.value = curRid();
  renderProg(); renderList(); renderSummary();
}
async function downloadAll() {
  await data();
  const rid = $('#dlReciter').value;
  const miss = IDX.filter(s => !isSaved(rid, s.n)).map(s => s.n);
  const size = miss.reduce((t, n) => t + est(rid, n), 0);
  const cell = navigator.connection && /cellular/.test(navigator.connection.type || '') ? '\n\n⚠️ আপনি এখন মোবাইল ডেটায় আছেন!' : '';
  if (!confirm(`${rec(rid)[2]}-এর কণ্ঠে বাকি ${bn(miss.length)}টি সূরা ডাউনলোড হবে — প্রায় ${mb(size)}।\n\nWi-Fi ব্যবহার করুন। মাঝপথে বিরতি দিতে পারবেন; অ্যাপ বন্ধ হলেও পরে যেখানে থেমেছিল সেখান থেকে চলবে।${cell}\n\nশুরু করবেন?`)) return;
  enqueue(miss.map(n => [rid, n]));
}
async function deleteAll() {
  const rid = $('#dlReciter').value;
  const list = Object.keys(saved).filter(k => k.startsWith(rid + ':')).map(k => +k.split(':')[1]);
  if (!list.length || !confirm(`${rec(rid)[2]}-এর ${bn(list.length)}টি সূরার অফলাইন অডিও মুছে ফেলবেন?`)) return;
  for (const n of list) await remove(rid, n);
  toast('মুছে ফেলা হয়েছে');
}
async function toggle(rid, n) {        // used by the surah reader's button
  await data();
  if (isSaved(rid, n)) { if (confirm('এই সূরার অফলাইন অডিও মুছে ফেলবেন?')) await remove(rid, n); return; }
  if (q && q.items.some(x => x[0] === rid && x[1] === n)) { if (q.paused) resume(); toast('ডাউনলোড তালিকায় আছে'); return; }
  enqueue([[rid, n]]); toast(`সূরা ${IDX[n - 1].bn} ডাউনলোড হচ্ছে — ≈ ${mb(est(rid, n))}`);
}
function state(rid, n) {             // for other screens: {saved, bytes, queued, pct}
  const queued = !!(q && q.items.some(x => x[0] === rid && x[1] === n));
  return {saved: isSaved(rid, n), bytes: isSaved(rid, n) ? savedBytes(rid, n) : est(rid, n), queued, paused: !!(q && q.paused), pct: cur && cur.rid === rid && cur.n === n ? Math.floor(cur.d / cur.c * 100) : null, mb};
}

document.addEventListener('click', e => {
  const t = e.target;
  if (!t.closest('#tab-dl')) return;
  const g = t.closest('[data-get]'); if (g) return enqueue([[$('#dlReciter').value, +g.dataset.get]]);
  const d = t.closest('[data-del]'); if (d) { const n = +d.dataset.del; if (confirm(`সূরা ${IDX[n - 1].bn}-এর অফলাইন অডিও মুছবেন?`)) remove($('#dlReciter').value, n); return; }
  if (t.closest('#dlAll')) return downloadAll();
  if (t.closest('#dlDelAll')) return deleteAll();
  if (t.closest('#dlPause')) return q && q.paused ? resume() : pause();
  if (t.closest('#dlCancel')) { if (confirm('ডাউনলোড বাতিল করবেন? যেগুলো শেষ হয়েছে সেগুলো থাকবে।')) cancel(); return; }
  const f = t.closest('[data-dlf]'); if (f) { onlySaved = f.dataset.dlf === 'saved'; document.querySelectorAll('[data-dlf]').forEach(x => x.classList.toggle('on', x === f)); renderList(); }
});
document.addEventListener('change', e => { if (e.target.id === 'dlReciter') { if (window.NZQ && NZQ.setReciter) NZQ.setReciter(e.target.value); render(); } });
let ft; document.addEventListener('input', e => { if (e.target.id === 'dlSearch') { clearTimeout(ft); ft = setTimeout(() => { filt = e.target.value; renderList(); }, 150); } });
document.addEventListener('nz-tab', e => { if (e.detail === 'dl') render(); });
document.addEventListener('nz-dl', e => { if (!$('#tab-dl').classList.contains('hidden')) { if (onlySaved) renderList(); else updateRow(e.detail.n); renderSummary(); } });
addEventListener('online', () => { if (q && q.paused && q.err) resume(); });
// resume an unfinished download after an app restart (skips files already saved)
if (q && q.items.length && !q.paused) setTimeout(() => { if (navigator.onLine === false) { q.paused = true; q.err = 'ইন্টারনেট সংযোগ নেই'; saveQ(); render(); return; } toast('অসম্পূর্ণ ডাউনলোড আবার চালু হচ্ছে…'); run(); }, 2500);
persist().catch(() => {});
window.NZDL = { RECITERS, rec, url, backend, isSaved, state, toggle, enqueue, pause, resume, cancel, remove, mb, est, data, get queue() { return q; } };
})();
