/* নামাজের সময়সূচি — dfaster.com/namaz */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const API = 'https://api.aladhan.com/v1/calendar/';
const BN_DIG = '০১২৩৪৫৬৭৮৯';
const bn = v => String(v).replace(/\d/g, d => BN_DIG[d]);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WEEK = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
const GMON = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const HMON = ['মুহাররম','সফর','রবিউল আউয়াল','রবিউস সানি','জমাদিউল আউয়াল','জমাদিউস সানি','রজব','শাবান','রমজান','শাওয়াল','জিলকদ','জিলহজ'];
const BMON = ['বৈশাখ','জ্যৈষ্ঠ','আষাঢ়','শ্রাবণ','ভাদ্র','আশ্বিন','কার্তিক','অগ্রহায়ণ','পৌষ','মাঘ','ফাল্গুন','চৈত্র'];
const PR = [
  {k:'Fajr',n:'ফজর',ic:'🌄',en:'Fajr'},
  {k:'Sunrise',n:'সূর্যোদয়',ic:'☀️',sun:1},
  {k:'Dhuhr',n:'যোহর',ic:'🌞'},
  {k:'Asr',n:'আসর',ic:'🌤️'},
  {k:'Maghrib',n:'মাগরিব',ic:'🌇'},
  {k:'Isha',n:'এশা',ic:'🌙'}
];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ---------- state ----------
const DHAKA = DISTRICTS[0];
let loc = store.get('nz-loc', {name: DHAKA[0], lat: DHAKA[2], lng: DHAKA[3], tz: 'Asia/Dhaka', d: 0});
let school = store.get('nz-school', 1);
let hijriAdj = store.get('nz-hadj', -1);
let months = {};          // 'YYYY-MM' -> [day entries]
let today = null;         // computed schedule for today
let mOffset = 0;
let offline = false;

// ---------- helpers ----------
function tzParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short'});
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return {y: +p.year, m: +p.month, d: +p.day, key: `${p.year}-${p.month}-${p.day}`};
}
function addDays(y, m, d, n) { const t = new Date(Date.UTC(y, m - 1, d + n)); return {y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), key: t.toISOString().slice(0, 10)}; }
function parseT(str, ymd) {          // "04:48 (+06)" -> epoch ms
  const m = /(\d{1,2}):(\d{2})(?:\s*\(([+-])(\d{2})(\d{2})?\))?/.exec(str);
  let off = 0; if (m[3]) off = (m[3] === '-' ? -1 : 1) * (+m[4] * 60 + +(m[5] || 0));
  return Date.UTC(ymd.y, ymd.m - 1, ymd.d, +m[1], +m[2]) - off * 60000;
}
function fmt(ms, withPart = true) {     // epoch -> "৪:৪৮ ভোর" in location tz
  const p = new Intl.DateTimeFormat('en-GB', {timeZone: loc.tz, hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(new Date(ms));
  const h = +p.find(x => x.type === 'hour').value, mi = p.find(x => x.type === 'minute').value;
  const h12 = h % 12 || 12;
  const part = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 11 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 17 ? 'বিকাল' : h < 19 ? 'সন্ধ্যা' : 'রাত';
  return bn(`${h12}:${mi}`) + (withPart ? ` <small>${part}</small>` : '');
}
const plain = ms => fmt(ms, false);
function dur(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); return bn(`${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`); }
const MIN = 60000;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600); }

// ---------- dates ----------
function banglaDate(y, m, d) {  // revised Bangladesh calendar (Bongabdo, 2019)
  const t = Date.UTC(y, m - 1, d);
  let by = y - 593, start = Date.UTC(y, 3, 14);
  if (t < start) { by--; start = Date.UTC(y - 1, 3, 14); }
  let idx = Math.round((t - start) / 864e5);
  const gy = new Date(start).getUTCFullYear() + 1;            // Falgun falls in this Gregorian year
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const len = [31,31,31,31,31,31,30,30,30,30,leap ? 30 : 29,30];
  let mi = 0; while (idx >= len[mi]) { idx -= len[mi]; mi++; }
  return `${bn(idx + 1)} ${BMON[mi]} ${bn(by)} বঙ্গাব্দ`;
}
function hijriDate(y, m, d) {
  try {
    const dt = new Date(Date.UTC(y, m - 1, d + hijriAdj, 12));
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {timeZone:'UTC', day:'numeric', month:'numeric', year:'numeric'}).formatToParts(dt).map(x => [x.type, x.value]));
    return `${bn(p.day)} ${HMON[+p.month - 1]} ${bn(parseInt(p.year))} হিজরি`;
  } catch { return ''; }
}

// ---------- data ----------
const ckey = (y, m) => `nz-cal:${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}:${school}:${y}-${pad(m)}`;
async function getMonth(y, m) {
  const id = `${y}-${pad(m)}`;
  if (months[id]) return months[id];
  const k = ckey(y, m);
  const cached = store.get(k, null);
  const url = `${API}${y}/${m}?latitude=${loc.lat}&longitude=${loc.lng}&method=1&school=${school}&timezonestring=${encodeURIComponent(loc.tz)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (j.code !== 200 || !Array.isArray(j.data)) throw new Error('bad');
    const days = j.data.map(x => ({t: x.timings, g: x.date.gregorian.date}));
    store.set(k, days); pruneCache();
    offline = false;
    return (months[id] = days);
  } catch (e) {
    if (cached) { offline = true; return (months[id] = cached); }
    throw e;
  }
}
function pruneCache() {
  const ks = Object.keys(localStorage).filter(k => k.startsWith('nz-cal:'));
  if (ks.length > 8) ks.slice(0, ks.length - 8).forEach(k => localStorage.removeItem(k));
}
async function dayEntry(ymd) {
  const days = await getMonth(ymd.y, ymd.m);
  return days[ymd.d - 1];
}
function sched(e, ymd) {
  const o = {}; for (const k in e.t) o[k] = parseT(e.t[k], ymd); return o;
}

// ---------- render: today ----------
async function load() {
  setStatus('লোড হচ্ছে…');
  months = {};
  const now = tzParts(new Date(), loc.tz);
  const y0 = addDays(now.y, now.m, now.d, -1), y1 = addDays(now.y, now.m, now.d, 1);
  try {
    const [ey, e0, e1] = await Promise.all([dayEntry(y0), dayEntry(now), dayEntry(y1)]);
    today = {ymd: now, prev: sched(ey, y0), cur: sched(e0, now), next: sched(e1, y1)};
    renderToday();
    document.dispatchEvent(new CustomEvent('nz-loaded'));
    setStatus(offline ? '⚠️ অফলাইন — সর্বশেষ সংরক্ষিত সময় দেখানো হচ্ছে' : '');
  } catch (e) {
    setStatus('❌ সময় লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
  }
  if (!$('#tab-month').classList.contains('hidden')) renderMonth();
}
function setStatus(s) { $('#status').textContent = s; }

function periods() {
  const {prev, cur, next} = today;
  return [
    {k:'Isha', n:'এশা', s: prev.Isha, e: cur.Fajr},
    {k:'Fajr', n:'ফজর', s: cur.Fajr, e: cur.Sunrise},
    {k:'Duha', n:'ইশরাক/চাশতের সময়', s: cur.Sunrise, e: cur.Dhuhr, gap: 1},
    {k:'Dhuhr', n: isFriday() ? 'জুমুআ/যোহর' : 'যোহর', s: cur.Dhuhr, e: cur.Asr},
    {k:'Asr', n:'আসর', s: cur.Asr, e: cur.Maghrib},
    {k:'Maghrib', n:'মাগরিব', s: cur.Maghrib, e: cur.Isha},
    {k:'Isha', n:'এশা', s: cur.Isha, e: next.Fajr},
    {k:'Fajr', n:'ফজর', s: next.Fajr, e: next.Sunrise, tomorrow: 1}
  ];
}
function isFriday() { const {y, m, d} = today.ymd; return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5; }

function renderToday() {
  const {ymd, cur, next} = today;
  const wd = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
  $('#dGreg').textContent = `${WEEK[wd]}, ${bn(ymd.d)} ${GMON[ymd.m - 1]} ${bn(ymd.y)}`;
  $('#dHijri').textContent = hijriDate(ymd.y, ymd.m, ymd.d);
  $('#dBangla').textContent = banglaDate(ymd.y, ymd.m, ymd.d);
  $('#methodNote').textContent = `করাচি পদ্ধতি • আসর: ${school ? 'হানাফী' : 'শাফেয়ী'}`;

  $('#times').innerHTML = PR.map(p => {
    const label = p.k === 'Dhuhr' && wd === 5 ? 'জুমুআ' : p.n;
    const sub = {Fajr:'সুবহে সাদিক', Sunrise:'ফজরের শেষ সময়', Dhuhr:'সূর্য ঢলে পড়ার পর', Asr: school ? 'ছায়া দ্বিগুণ হলে' : 'ছায়া সমান হলে', Maghrib:'সূর্যাস্তের পর', Isha:'পশ্চিম আকাশের আভা মিলিয়ে গেলে'}[p.k];
    return `<li data-k="${p.k}" class="${p.sun ? 'sun' : ''}"><span class="ic">${p.ic}</span><span class="nm">${label}<small>${sub}</small></span><span class="tm">${fmt(cur[p.k])}</span></li>`;
  }).join('');

  $('#sehri').innerHTML = fmt(cur.Fajr);
  $('#iftar').innerHTML = fmt(cur.Maghrib);
  const quarter = cur.Sunrise + (cur.Sunset - cur.Sunrise) / 4;
  $('#nafl').innerHTML = [
    ['তাহাজ্জুদ (রাতের শেষ ⅓)', `${plain(cur.Lastthird)} – ${plain(cur.Fajr)}`],
    ['ইশরাক', `${plain(cur.Sunrise + 15 * MIN)} থেকে`],
    ['চাশত/দুহা (উত্তম)', `${plain(quarter)} – ${plain(cur.Dhuhr - 8 * MIN)}`],
    ['মধ্যরাত (এশার উত্তম সময়ের সীমা)', plain(cur.Midnight)]
  ].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  $('#makruh').innerHTML = [
    ['🌅 সূর্যোদয়ের সময়', `${plain(cur.Sunrise)} – ${plain(cur.Sunrise + 15 * MIN)}`],
    ['🌞 ঠিক দুপুর (যাওয়াল)', `${plain(cur.Dhuhr - 8 * MIN)} – ${plain(cur.Dhuhr)}`],
    ['🌇 সূর্যাস্তের সময়', `${plain(cur.Sunset - 15 * MIN)} – ${plain(cur.Sunset)}`]
  ].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('');
  renderWaqt();
  tick();
}

let lastCur = '';
function tick() {
  if (!today) return;
  const now = Date.now();
  const nowYmd = tzParts(new Date(), loc.tz);
  if (nowYmd.key !== today.ymd.key) { load(); return; }
  const ps = periods();
  const i = ps.findIndex(p => now >= p.s && now < p.e);
  const p = ps[i] || ps[ps.length - 1];
  const nx = ps.slice(i + 1).find(x => !x.gap) || ps[ps.length - 1];
  $('#nowName').textContent = p.gap ? 'কোনো ফরজ ওয়াক্ত নেই' : p.n;
  $('#nowRange').innerHTML = p.gap ? `সূর্যোদয় ${plain(p.s)} থেকে যোহর ${plain(p.e)} পর্যন্ত — ইশরাক/চাশত পড়ার সময়` : `${plain(p.s)} থেকে ${plain(p.e)} পর্যন্ত`;
  const fard = !p.gap;
  $('#nextLabel').textContent = fard ? 'ওয়াক্ত শেষ হতে বাকি' : 'পরবর্তী ওয়াক্ত';
  $('#nextName').textContent = fard ? `• পরবর্তী: ${p.k === 'Fajr' ? 'সূর্যোদয়' : nx.n}` : nx.n;
  $('#nextAt').innerHTML = fard ? '' : `(${plain(nx.s)})`;
  const target = fard ? p.e : nx.s;
  $('#countdown').textContent = dur(target - now);
  const span = fard ? p.e - p.s : nx.s - p.s;
  $('#progress').style.width = Math.min(100, Math.max(0, (now - p.s) / span * 100)) + '%';
  const curK = p.gap ? '' : p.k;
  const nextK = fard ? (p.k === 'Fajr' ? 'Sunrise' : nx.k) : nx.k;
  const sig = curK + '|' + nextK;
  if (sig !== lastCur) {
    lastCur = sig;
    document.querySelectorAll('#times li').forEach(li => { li.classList.toggle('cur', li.dataset.k === curK && !(p.tomorrow)); li.classList.toggle('nxt', li.dataset.k === nextK && li.dataset.k !== curK); });
    document.title = `${p.gap ? nx.n + ' ' + plain(nx.s) : p.n + ' চলছে'} | নামাজের সময়সূচি`;
  }
}

// ---------- waqt details ----------
const WAQT = [
  {k:'Fajr', ic:'🌄', n:'ফজর', s:'Fajr', e:'Sunrise', es:'সূর্যোদয়', tot:'৪ রাকাত',
   rk:[['sm','২ সুন্নাত (মুয়াক্কাদা)'],['fard','২ ফরজ']],
   notes:['সুবহে সাদিক (পূর্ব আকাশে সাদা আলো ছড়িয়ে পড়া) থেকে সূর্যোদয়ের আগ পর্যন্ত।','ফজরের সুন্নাত সবচেয়ে গুরুত্বপূর্ণ সুন্নাত; ফরজের আগে পড়তে হয়।','আকাশ কিছুটা ফর্সা হলে পড়া উত্তম (হানাফী)।']},
  {k:'Dhuhr', ic:'🌞', n:'যোহর', s:'Dhuhr', e:'Asr', es:'আসর শুরু', tot:'১২ রাকাত',
   rk:[['sm','৪ সুন্নাত (মুয়াক্কাদা)'],['fard','৪ ফরজ'],['sm','২ সুন্নাত (মুয়াক্কাদা)'],['','২ নফল']],
   notes:['সূর্য মাথার উপর থেকে পশ্চিমে ঢলে পড়ার পর শুরু হয়।','হানাফী মতে বস্তুর ছায়া (মূল ছায়া বাদে) দ্বিগুণ হওয়া পর্যন্ত থাকে।','গ্রীষ্মকালে একটু দেরিতে পড়া উত্তম।']},
  {k:'Jumuah', ic:'🕌', n:'জুমুআ (শুক্রবার)', s:'Dhuhr', e:'Asr', es:'আসর শুরু', tot:'১৪ রাকাত',
   rk:[['sm','৪ সুন্নাত (কাবলাল জুমুআ)'],['fard','২ ফরজ (জামাআতে)'],['sm','৪ সুন্নাত (বা\'দাল জুমুআ)'],['sm','২ সুন্নাত'],['','২ নফল']],
   notes:['জুমুআর সময় যোহরের সময়ের মতোই।','খুতবা শোনা ওয়াজিব; খুতবার সময় কথা বলা নিষেধ।','জুমুআ আদায় করলে যোহর পড়তে হয় না।']},
  {k:'Asr', ic:'🌤️', n:'আসর', s:'Asr', e:'Maghrib', es:'সূর্যাস্ত', tot:'৮ রাকাত',
   rk:[['','৪ সুন্নাত (গায়রে মুয়াক্কাদা)'],['fard','৪ ফরজ']],
   notes:['হানাফী: ছায়া দ্বিগুণ হলে শুরু; শাফেয়ী/অন্যান্য: ছায়া সমান হলে।','সূর্য হলদে হয়ে যাওয়ার পর (সূর্যাস্তের প্রায় ১৫–২০ মিনিট আগে) পর্যন্ত দেরি করা মাকরূহ।','আসরের ফরজের পর সূর্যাস্ত পর্যন্ত নফল সালাত নিষেধ।']},
  {k:'Maghrib', ic:'🌇', n:'মাগরিব', s:'Maghrib', e:'Isha', es:'এশা শুরু', tot:'৭ রাকাত',
   rk:[['fard','৩ ফরজ'],['sm','২ সুন্নাত (মুয়াক্কাদা)'],['','২ নফল']],
   notes:['সূর্য সম্পূর্ণ অস্ত যাওয়ার পর থেকে পশ্চিম আকাশের লালিমা/সাদা আভা মিলিয়ে যাওয়া পর্যন্ত।','আযানের পর দেরি না করে তাড়াতাড়ি পড়া মুস্তাহাব।','রমজানে এটিই ইফতারের সময়।']},
  {k:'Isha', ic:'🌙', n:'এশা ও বিতর', s:'Isha', e:'Fajr', es:'সুবহে সাদিক', tot:'১৭ রাকাত',
   rk:[['','৪ সুন্নাত (গায়রে মুয়াক্কাদা)'],['fard','৪ ফরজ'],['sm','২ সুন্নাত (মুয়াক্কাদা)'],['','২ নফল'],['wajib','৩ বিতর (ওয়াজিব)'],['','২ নফল']],
   notes:['আকাশের আভা মিলিয়ে যাওয়ার পর থেকে সুবহে সাদিক পর্যন্ত।','রাতের এক-তৃতীয়াংশ পর্যন্ত দেরি করা মুস্তাহাব; মধ্যরাতের পরে বিনা কারণে দেরি মাকরূহ।','বিতর এশার পরে ফজরের আগে যেকোনো সময়; শেষ রাতে জাগার ভরসা থাকলে তাহাজ্জুদের পর পড়া উত্তম।']},
  {k:'Tahajjud', ic:'✨', n:'তাহাজ্জুদ', s:'Lastthird', e:'Fajr', es:'সুবহে সাদিক', tot:'২–১২ রাকাত',
   rk:[['','২ থেকে ১২ রাকাত নফল (দুই দুই রাকাত করে)']],
   notes:['এশার পর ঘুম থেকে উঠে পড়া হয়; রাতের শেষ তৃতীয়াংশ সবচেয়ে উত্তম সময়।','এটি নফল, তবে অত্যন্ত ফযীলতপূর্ণ।']},
  {k:'Ishraq', ic:'🌅', n:'ইশরাক ও চাশত', s:'Sunrise', e:'Dhuhr', es:'যাওয়ালের আগে', tot:'২–১২ রাকাত', plus:15,
   rk:[['','ইশরাক: ২ বা ৪ রাকাত'],['','চাশত/দুহা: ২ থেকে ১২ রাকাত']],
   notes:['সূর্যোদয়ের প্রায় ১৫ মিনিট পর থেকে ইশরাক পড়া যায়।','সূর্য বেশ উপরে উঠলে (দিনের এক-চতুর্থাংশ পার হলে) চাশত পড়া উত্তম; যাওয়ালের আগে শেষ করতে হবে।']}
];
function renderWaqt() {
  if (!today) return;
  const {cur, next} = today;
  const open = new Set([...document.querySelectorAll('#waqtList details[open]')].map(d => d.dataset.k));
  $('#waqtList').innerHTML = WAQT.map(w => {
    const s = cur[w.s] + (w.plus || 0) * MIN;
    const e = w.e === 'Fajr' && w.s !== 'Lastthird' ? next.Fajr : (w.s === 'Lastthird' ? next.Fajr : cur[w.e]);
    const eT = w.s === 'Lastthird' ? cur.Fajr : (w.k === 'Ishraq' ? cur.Dhuhr - 8 * MIN : e);
    const sT = w.s === 'Lastthird' ? cur.Lastthird : s;
    return `<details class="card waqt" data-k="${w.k}" ${open.has(w.k) ? 'open' : ''}>
      <summary><span class="ic">${w.ic}</span><span class="t"><b>${w.n}</b><span>${plain(sT)} – ${plain(eT)}</span></span><span class="tot">${w.tot}</span></summary>
      <div class="body">
        <div class="span">⏱️ শুরু <b>${plain(sT)}</b> → শেষ <b>${plain(eT)}</b> <span class="muted">(${w.es})</span></div>
        <div class="rk">${w.rk.map(([c, t]) => `<span class="${c}">${t}</span>`).join('')}</div>
        <ul class="notes">${w.notes.map(n => `<li>${n}</li>`).join('')}</ul>
      </div></details>`;
  }).join('');
}

// ---------- monthly ----------
async function renderMonth() {
  const base = today ? today.ymd : tzParts(new Date(), loc.tz);
  const t = new Date(Date.UTC(base.y, base.m - 1 + mOffset, 1));
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1;
  $('#mTitle').textContent = `${GMON[m - 1]} ${bn(y)}`;
  $('#mBody').innerHTML = `<tr><td colspan="7" class="empty">লোড হচ্ছে…</td></tr>`;
  try {
    const days = await getMonth(y, m);
    $('#mBody').innerHTML = days.map((e, i) => {
      const ymd = {y, m, d: i + 1};
      const o = sched(e, ymd);
      const wd = new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay();
      const isToday = today && today.ymd.y === y && today.ymd.m === m && today.ymd.d === i + 1;
      return `<tr class="${isToday ? 'today' : ''} ${wd === 5 ? 'fri' : ''}"><td>${bn(i + 1)} <small>${WEEK[wd].replace('বার', '')}</small></td>${['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].map(k => `<td>${plain(o[k])}</td>`).join('')}</tr>`;
    }).join('');
  } catch { $('#mBody').innerHTML = `<tr><td colspan="7" class="empty">লোড করা যায়নি (অফলাইন?)</td></tr>`; }
}

// ---------- hadith ----------
let HD = null, hCat = '', hColF = '', hShown = 0, hFiltered = [], hodIdx = null;
const PAGE = 15;
async function loadHadith() {
  if (HD) return HD;
  const r = await fetch('data/hadith-salah.json?v=1');
  HD = await r.json();
  return HD;
}
function sunnahLink(x) {
  if (x.c === 'bukhari') return `https://sunnah.com/bukhari:${x.n}`;
  const [a, b] = String(x.an).split('.');
  return `https://sunnah.com/muslim:${a}${b ? String.fromCharCode(96 + parseInt(b, 10)) : ''}`;
}
const BL = 'কখগঘঙচছজঝঞটঠডঢণতথদধন';
function hnum(x) {               // Bukhari: standard number; Muslim: Abdul Baqi number (e.g. ৫২০ক)
  if (x.c === 'bukhari') return bn(x.n);
  const [a, b] = String(x.an).split('.');
  return bn(a) + (b && +b ? BL[(+b - 1) % BL.length] : '');
}
function refText(x) { return `${HD.collections[x.c]}, হাদিস নং ${hnum(x)}`; }
const norm = s => s.replace(/[’'‘`ʼ\u200c\u200d]/g, '').replace(/নামা[জয]/g, 'সালাত').replace(/জামা(?:\u0986|\u09DF|\u09AF\u09BC)?\u09BE?ত/g, 'জামাত');
const stripHarakat = s => s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
function hl(text, q) {
  const t = esc(text);
  if (!q) return t;
  const qq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return t.replace(new RegExp(qq, 'g'), m => `<mark>${m}</mark>`);
}
function hadithHTML(x, q = '', clamp = true) {
  const long = x.bn.length > 260;
  return `<article class="hadith">
    ${x.ar ? `<p class="ar ${clamp ? 'clamp' : ''}" lang="ar">${esc(x.ar)}</p>` : ''}
    <p class="bn ${clamp && long ? 'clamp' : ''}">${hl(x.bn, q)}</p>
    <div class="ref"><span class="tag">${refText(x)}</span><span class="cat">${x.cat}</span>
      ${clamp ? '<button data-act="more">পুরো পড়ুন</button>' : ''}
      <button data-act="copy" data-i="${HD.hadith.indexOf(x)}">কপি</button>
      <a href="${sunnahLink(x)}" target="_blank" rel="noopener">মূল সূত্র ↗</a></div>
  </article>`;
}
function dayIndex() { const {y, m, d} = today ? today.ymd : tzParts(new Date(), 'Asia/Dhaka'); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); }
async function renderHod(step = 0) {
  try {
    await loadHadith();
    if (hodIdx === null) hodIdx = dayIndex() % HD.daily.length;
    hodIdx = (hodIdx + step + HD.daily.length) % HD.daily.length;
    $('#hod').innerHTML = hadithHTML(HD.hadith[HD.daily[hodIdx]], '', false);
  } catch { $('#hod').innerHTML = '<p class="empty">হাদিস লোড করা যায়নি। ইন্টারনেট সংযোগ দেখুন।</p>'; }
}
async function initHadithBrowser() {
  await loadHadith();
  if ($('#hCats').childElementCount) return;
  const cats = {}; HD.hadith.forEach(x => cats[x.cat] = (cats[x.cat] || 0) + 1);
  $('#hCats').innerHTML = `<button class="chip on" data-c="">সব</button>` + Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<button class="chip" data-c="${c}">${c} ${bn(n)}</button>`).join('');
  filterHadith();
}
function filterHadith() {
  const raw = $('#hSearch').value.trim();
  const q = raw.replace(/[০-৯]/g, d => BN_DIG.indexOf(d));
  const qa = stripHarakat(q);
  const nq = norm(raw);
  hFiltered = HD.hadith.filter(x => (!hCat || x.cat === hCat) && (!hColF || x.c === hColF) &&
    (!q || (x._n || (x._n = norm(x.bn))).includes(nq) || String(x.n) === q || String(x.an).split('.')[0] === q || (qa && /[\u0600-\u06FF]/.test(qa) && stripHarakat(x.ar).includes(qa))));
  hShown = 0; $('#hList').innerHTML = '';
  $('#hCount').textContent = `${bn(hFiltered.length)}টি হাদিস`;
  moreHadith();
}
function moreHadith() {
  const q = $('#hSearch').value.trim();
  const slice = hFiltered.slice(hShown, hShown + PAGE);
  if (!hShown && !slice.length) $('#hList').innerHTML = '<p class="empty">কিছু পাওয়া যায়নি</p>';
  $('#hList').insertAdjacentHTML('beforeend', slice.map(x => hadithHTML(x, q)).join(''));
  hShown += slice.length;
  $('#hMore').classList.toggle('hidden', hShown >= hFiltered.length);
}

// ---------- UI wiring ----------
function fillDistricts() {
  const byDiv = {};
  DISTRICTS.forEach((d, i) => (byDiv[d[1]] = byDiv[d[1]] || []).push([d[0], i]));
  let h = loc.d === -1 ? `<option value="-1">📍 ${esc(loc.name)}</option>` : '';
  for (const [div, list] of Object.entries(byDiv)) h += `<optgroup label="${div} বিভাগ">${list.sort((a, b) => a[0].localeCompare(b[0], 'bn')).map(([n, i]) => `<option value="${i}">${n}</option>`).join('')}</optgroup>`;
  $('#district').innerHTML = h;
  $('#district').value = String(loc.d);
  $('#locNote').textContent = loc.d === -1 ? `আপনার অবস্থান (${bn(loc.lat.toFixed(3))}, ${bn(loc.lng.toFixed(3))}) অনুযায়ী সময়` : '';
}
function setLoc(l) { loc = l; store.set('nz-loc', loc); fillDistricts(); load(); }
$('#district').addEventListener('change', e => {
  const i = +e.target.value; if (i < 0) return;
  const d = DISTRICTS[i]; setLoc({name: d[0], lat: d[2], lng: d[3], tz: 'Asia/Dhaka', d: i});
});
$('#locBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('আপনার ব্রাউজারে লোকেশন সুবিধা নেই');
  toast('লোকেশন খোঁজা হচ্ছে…');
  navigator.geolocation.getCurrentPosition(p => {
    const lat = +p.coords.latitude.toFixed(4), lng = +p.coords.longitude.toFixed(4);
    let best = null, bd = 1e9;
    DISTRICTS.forEach(d => { const dd = Math.hypot(d[2] - lat, (d[3] - lng) * Math.cos(lat * Math.PI / 180)) * 111; if (dd < bd) { bd = dd; best = d; } });
    const name = best && bd < 60 ? `আমার অবস্থান (${best[0]}-এর কাছে)` : 'আমার অবস্থান';
    setLoc({name, lat, lng, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka', d: -1});
    toast('আপনার অবস্থান অনুযায়ী সময় দেখানো হচ্ছে');
  }, () => toast('লোকেশনের অনুমতি পাওয়া যায়নি'), {enableHighAccuracy: false, timeout: 15000, maximumAge: 6e5});
});
document.querySelectorAll('input[name=school]').forEach(r => {
  r.checked = +r.value === school;
  r.addEventListener('change', () => { school = +r.value; store.set('nz-school', school); load(); });
});
function setThemeIcon() { $('#themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; }
$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; store.set('nz-theme', t); localStorage.setItem('nz-theme', t); setThemeIcon();
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#071311' : '#0f766e';
});
$('#dHijri').title = 'চাপ দিয়ে হিজরি তারিখ ±১ দিন ঠিক করুন';
$('#dHijri').style.cursor = 'pointer';
$('#dHijri').addEventListener('click', () => {
  hijriAdj = hijriAdj >= 1 ? -2 : hijriAdj + 1; store.set('nz-hadj', hijriAdj);
  if (today) $('#dHijri').textContent = hijriDate(today.ymd.y, today.ymd.m, today.ymd.d);
  toast(`হিজরি সমন্বয়: ${hijriAdj > 0 ? '+' : ''}${bn(hijriAdj)} দিন`);
});
// ---------- tabs + history (top tabs, bottom nav, hardware/gesture back) ----------
const TABS = ['waqt', 'hadith', 'quran', 'guide', 'month', 'dl'];
let curTab = 'waqt';
function showTab(t, {push = true} = {}) {
  if (!TABS.includes(t)) t = 'waqt';
  const changed = t !== curTab; curTab = t;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === t));
  document.querySelectorAll('#bnav [data-go]').forEach(x => { const on = x.dataset.go === t || (x.dataset.go === 'waqt' && t === 'month'); x.classList.toggle('on', on); on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'); });
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('hidden', x.id !== 'tab-' + t));
  if (t === 'hadith') initHadithBrowser().catch(() => $('#hList').innerHTML = '<p class="empty">হাদিস লোড করা যায়নি</p>');
  if (t === 'month') renderMonth();
  const tabHash = location.hash.slice(1).split('/')[0];
  if (push && changed) history.pushState({d: depth() + 1}, '', '#' + t);
  else if (push && tabHash !== t) history.replaceState({d: depth()}, '', '#' + t);
  document.dispatchEvent(new CustomEvent('nz-tab', {detail: t}));
  syncBack();
}
const depth = () => (history.state && history.state.d) || 0;
function syncBack() { const b = $('#bnBack'); if (b) b.disabled = depth() === 0 && curTab === 'waqt'; }
function goBack() {
  if (depth() > 0) history.back();
  else if (curTab !== 'waqt') showTab('waqt', {push: false}), history.replaceState({d: 0}, '', location.pathname + location.search);
}
addEventListener('popstate', () => { showTab(location.hash.slice(1).split('/')[0] || 'waqt', {push: false}); });
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
document.addEventListener('click', e => {
  const g = e.target.closest('#bnav [data-go]');
  if (g) {
    const t = g.dataset.go, tabsTop = $('#tabs').offsetTop;
    if (t === curTab) { if (t === 'quran' && !$('#qReader').classList.contains('hidden') && window.NZQ) NZQ.closeReader(); scrollTo({top: t === 'waqt' ? 0 : tabsTop, behavior: 'smooth'}); return; }
    showTab(t);
    if (t === 'waqt') scrollTo({top: 0}); else if (scrollY > tabsTop) scrollTo({top: tabsTop});
    return;
  }
  if (e.target.closest('#bnBack')) goBack();
});
$('#mPrev').addEventListener('click', () => { mOffset--; renderMonth(); });
$('#mNext').addEventListener('click', () => { mOffset++; renderMonth(); });
$('#mPrint').addEventListener('click', () => window.print());
$('#hodNext').addEventListener('click', () => renderHod(1));
let st; $('#hSearch').addEventListener('input', () => { clearTimeout(st); st = setTimeout(filterHadith, 200); });
$('#hCats').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; hCat = b.dataset.c; document.querySelectorAll('#hCats .chip').forEach(x => x.classList.toggle('on', x === b)); filterHadith(); });
document.querySelectorAll('input[name=col]').forEach(r => r.addEventListener('change', () => { hColF = r.value; filterHadith(); }));
$('#hMore').addEventListener('click', moreHadith);
document.addEventListener('click', async e => {
  const b = e.target.closest('.ref button'); if (!b) return;
  const art = b.closest('.hadith');
  if (b.dataset.act === 'more') { art.querySelectorAll('.clamp').forEach(x => x.classList.remove('clamp')); b.remove(); }
  if (b.dataset.act === 'copy') {
    const x = HD.hadith[+b.dataset.i];
    const text = `${x.bn}\n\n— ${refText(x)}\n${sunnahLink(x)}`;
    try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({text}); else { await navigator.clipboard.writeText(text); toast('কপি হয়েছে'); } } catch {}
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

// ---------- start ----------
setThemeIcon();
fillDistricts();
load().then(() => renderHod());
setInterval(tick, 1000);
window.NZ = { get today() { return today; }, plain: t => plain(t), toast, showTab, goBack, depth, syncBack, get tab() { return curTab; },
  // next n days of the 5 waqt start times (ms epoch) for the selected district & madhhab
  async upcoming(n = 7) {
    const now = tzParts(new Date(), loc.tz), out = [];
    for (let i = 0; i < n; i++) {
      const ymd = addDays(now.y, now.m, now.d, i);
      const s = sched(await dayEntry(ymd), ymd);
      for (const k of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) out.push({k, ts: +s[k], ymd});
    }
    return out.filter(x => x.ts > Date.now());
  },
  get place() { return {lat: loc.lat, lng: loc.lng, name: loc.name, school}; } };
if (!history.state) history.replaceState({d: 0}, '', location.href);
{ const h = location.hash.slice(1).split('/')[0]; if (TABS.includes(h) && h !== 'waqt') showTab(h, {push: false}); else syncBack(); }
if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform())) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
