/* Android অ্যাপ (Capacitor) — নেটিভ আযান: অ্যাপ বন্ধ/ফোন লক থাকলেও প্রতি ওয়াক্তে আযান বাজে */
(() => {
'use strict';
const C = window.Capacitor;
if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
document.documentElement.classList.add('native');
const $ = s => document.querySelector(s);
const Azan = C.Plugins.Azan || (C.registerPlugin && C.registerPlugin('Azan'));
const BD = '০১২৩৪৫৬৭৮৯', bn = v => String(v).replace(/\d/g, d => BD[d]);
const W = [['Fajr', 'ফজর', 'ফজরের'], ['Dhuhr', 'যোহর', 'যোহরের'], ['Asr', 'আসর', 'আসরের'], ['Maghrib', 'মাগরিব', 'মাগরিবের'], ['Isha', 'এশা', 'এশার']];
const DAYS = 14;
const get = () => { try { return Object.assign({Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true}, JSON.parse(localStorage.getItem('nz-azan') || '{}')); } catch { return {}; } };
const set = v => localStorage.setItem('nz-azan', JSON.stringify(v));
const hm = ts => { const d = new Date(ts); let h = d.getHours(), m = d.getMinutes(); const h12 = h % 12 || 12; return `${bn(h12)}:${bn(String(m).padStart(2, '0'))}`; };

function ui() {
  ['#apkLink', '#notifyRow', '#apkBtn', '#apkBar'].forEach(s => { const e = $(s); if (e) e.classList.add('hidden'); });
  $('#azanSet').classList.remove('hidden');
  const on = get();
  if (!$('#azanDiag')) $('#azanSet').insertAdjacentHTML('beforeend', `
    <div class="r-actions"><button class="btn ghost" id="azanTest1m">⏱ ১ মিনিট পরে পরীক্ষা (অ্যাপ বন্ধ করে দেখুন)</button><button class="btn ghost" id="azanStop">⏹ আযান থামান</button></div>
    <h3 class="g-h" style="margin-top:14px">✅ আযান বাজার চেকলিস্ট</h3>
    <div id="azanDiag"><p class="hint">যাচাই হচ্ছে…</p></div>
    <h3 class="g-h" style="margin-top:14px">🎵 নিজের আযান বেছে নিন</h3>
    <p class="hint" style="margin-top:0">ফোনে থাকা যেকোনো অডিও ফাইল (MP3/M4A/OGG) আযান হিসেবে রাখতে পারেন। ফাইলটি অ্যাপের ভেতরে কপি হয়, তাই মূল ফাইল সরালেও চলবে। ফাইল চালানো না গেলে অ্যাপের নিজস্ব আযান বাজবে।</p>
    <div id="azanCustom"></div>
    <label class="az-row"><span><b>সাইলেন্ট/ভাইব্রেট মোডে আযান বাজবে না</b><small>বন্ধ রাখলে (প্রস্তাবিত) ফোন সাইলেন্টে থাকলেও আযান বাজবে, যেমন অ্যালার্ম বাজে</small></span><span class="notify-row" style="border:0;padding:0;margin:0"><input type="checkbox" id="azRespect" role="switch"><i class="sw-ui"></i></span></label>
    <p class="hint" id="azLast"></p>`);
  $('#azanToggles').innerHTML = W.map(([k, n]) => `<label class="az-row"><span><b>${n}</b><small id="azn-${k}">—</small></span><span class="notify-row" style="border:0;padding:0;margin:0"><input type="checkbox" data-k="${k}" role="switch" ${on[k] ? 'checked' : ''}><i class="sw-ui"></i></span></label>`).join('');
}
let busy = false, again = false;
async function schedule() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    const on = get();
    const list = await window.NZ.upcoming(DAYS);
    const place = window.NZ.place.name || '';
    const items = list.filter(x => on[x.k]).map(x => {
      const w = W.find(a => a[0] === x.k);
      return {id: Math.floor(x.ts / 60000) % 2000000000, at: x.ts, title: `${w[2]} আযান`, body: `${w[2]} ওয়াক্ত শুরু — ${place} ${hm(x.ts)}`, sound: 'azan'};
    });
    const r = await Azan.schedule({items});
    for (const [k] of W) {
      const nx = list.find(x => x.k === k), el = $('#azn-' + k);
      if (el) el.textContent = on[k] ? (nx ? `পরের আযান: ${new Date(nx.ts).toDateString() === new Date().toDateString() ? 'আজ' : 'আগামীকাল'} ${hm(nx.ts)}` : '—') : 'বন্ধ';
    }
    const exact = r && r.exact;
    $('#azanNote').innerHTML = `${bn(items.length)}টি আযান সেট আছে (পরের ${bn(DAYS)} দিন, ${place})। অ্যাপ খুললেই সময় নতুন করে হালনাগাদ হয়। আযান অ্যালার্মের ভলিউমে বাজে।` +
      (exact === false ? ' <b>⚠️ “অ্যালার্ম ও রিমাইন্ডার” অনুমতি বন্ধ — আযান কয়েক মিনিট দেরিতে বাজতে পারে।</b> <button class="chip" id="azExact">অনুমতি দিন</button>' : '') +
      ' কিছু ফোনে (Xiaomi, Oppo, Vivo, Samsung) ব্যাটারি সেভার অ্যাপ বন্ধ করে দেয় — <button class="chip" id="azBatt">ব্যাটারি সেটিং</button> থেকে এই অ্যাপকে “Unrestricted/No restriction” করুন।';
  } catch (e) {
    $('#azanNote').textContent = 'আযান সেট করা যায়নি: ' + (e && e.message || e) + ' — ইন্টারনেট চালু করে অ্যাপটি আবার খুলুন।';
  } finally {
    busy = false; if (again) { again = false; schedule(); }
  }
}
const row = (ok, label, hint, btn) => `<div class="az-row"><span><b>${ok ? '✅' : '❌'} ${label}</b>${hint ? `<small>${hint}</small>` : ''}</span>${!ok && btn ? btn : ''}</div>`;
async function diag() {
  let d; try { d = await Azan.diagnostics(); } catch (e) { $('#azanDiag').innerHTML = '<p class="hint">চেকলিস্ট পড়া যায়নি</p>'; return; }
  const volOk = d.alarmVol > 0 && d.alarmVol >= Math.ceil(d.alarmMax / 2);
  $('#azanDiag').innerHTML =
    row(d.notifications && d.channel, 'নোটিফিকেশন চালু', d.notifications ? (d.channel ? '' : '“আযান” নোটিফিকেশন ক্যাটাগরি বন্ধ করা আছে') : 'বন্ধ থাকলে আযানের নোটিফিকেশন/বন্ধ করার বোতাম দেখা যাবে না', '<button class="chip" data-az="notif">চালু করুন</button>') +
    row(d.exact, 'অ্যালার্ম ও রিমাইন্ডার (সঠিক সময়ে আযান)', d.exact ? '' : 'বন্ধ থাকলে আযান দেরিতে বাজতে পারে', '<button class="chip" data-az="exact">অনুমতি দিন</button>') +
    row(d.battery, 'ব্যাটারি সীমাবদ্ধতা নেই', d.battery ? '' : `${esc(d.maker)} ফোনে ব্যাটারি সেভার অ্যাপ বন্ধ করে দিতে পারে — এই অ্যাপকে “Unrestricted / No restriction / Don't optimize” করুন`, '<button class="chip" data-az="batt">ব্যাটারি সেটিং</button>') +
    row(volOk, `অ্যালার্ম ভলিউম ${bn(d.alarmVol)}/${bn(d.alarmMax)}`, volOk ? 'আযানের সময় অ্যাপ নিজেই ফুল ভলিউম করে দেয়' : 'অ্যালার্ম ভলিউম কম — আযানের সময় অ্যাপ বাড়িয়ে দেয়, তবু এখানে বাড়িয়ে রাখুন', '<button class="chip" data-az="vol">ভলিউম বাড়ান</button>') +
    row(d.mediaVol > 0, `মিডিয়া ভলিউম ${bn(d.mediaVol)}/${bn(d.mediaMax)} (কুরআন তিলাওয়াত)`, d.mediaVol > 0 ? '' : 'মিডিয়া ভলিউম শূন্য — তিলাওয়াত শোনা যাবে না', '<button class="chip" data-az="vol">ভলিউম বাড়ান</button>') +
    row(d.ringer === 'normal' || !d.respectSilent, d.ringer === 'normal' ? 'ফোন সাধারণ (রিং) মোডে' : `ফোন ${d.ringer === 'vibrate' ? 'ভাইব্রেট' : 'সাইলেন্ট'} মোডে`, d.ringer === 'normal' ? '' : (d.respectSilent ? 'নিচের সেটিং চালু থাকায় এখন আযান বাজবে না' : 'তবু আযান বাজবে (অ্যালার্মের মতো)'), '<button class="chip" data-az="sound">সাউন্ড সেটিং</button>') +
    (d.dnd ? row(true, '“বিরক্ত করবেন না” (DND) চালু', 'অ্যালার্ম অনুমোদিত থাকলে আযান বাজবে — DND সেটিংয়ে “Alarms” চালু রাখুন', '') : '') +
    row(d.armed > 0, `${bn(d.armed)}টি আযান সেট আছে`, '', '');
  $('#azanCustom').innerHTML = [['main', 'আযান (সব ওয়াক্ত, ফজরসহ)', d.customMain]].map(([w, l, c]) =>
    `<div class="az-row"><span><b>${l}</b><small>${c ? '🎵 ' + esc(c) : 'অ্যাপের নিজস্ব আযান'}</small></span><span class="chips"><button class="chip" data-pick="${w}">ফাইল বাছুন</button><button class="chip" data-prev="${w}">▶</button>${c ? `<button class="chip" data-reset="${w}">ডিফল্ট</button>` : ''}</span></div>`).join('');
  $('#azRespect').checked = !!d.respectSilent;
  $('#azLast').textContent = d.last ? `শেষ অবস্থা: ${d.last} (${new Date(d.lastAt).toLocaleString('bn-BD')})` : '';
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const toast = m => (window.NZ && NZ.toast ? NZ.toast(m) : alert(m));
async function perms() {
  try { const p = await Azan.checkPermissions(); if (p.notifications !== 'granted') await Azan.requestPermissions(); } catch {}
}
document.addEventListener('change', e => {
  if (e.target.id === 'azRespect') { Azan.setRespectSilent({value: e.target.checked}).then(diag).catch(() => {}); return; }
  const k = e.target.dataset && e.target.dataset.k; if (!k || !e.target.closest('#azanToggles')) return;
  const v = get(); v[k] = e.target.checked; set(v); schedule();
});
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#azanTest')) Azan.test({sound: 'azan'}).then(() => setTimeout(diag, 1500)).catch(err => toast('আযান চালানো যায়নি: ' + (err && err.message || err)));
  if (t.closest('#azanStop')) Azan.stop().catch(() => {});
  if (t.closest('#azanTest1m')) Azan.testIn({seconds: 60}).then(r => toast(`১ মিনিট পরে আযান বাজবে${r && r.exact === false ? ' (অনুমতি না থাকায় একটু দেরি হতে পারে)' : ''} — এখন অ্যাপ বন্ধ করে ফোন লক করে দেখুন`)).catch(err => toast('সেট করা যায়নি: ' + (err && err.message || err)));
  const az = t.closest('[data-az]');
  if (az) {
    const k = az.dataset.az;
    const f = k === 'notif' ? Azan.requestPermissions().then(p => { if (p.notifications !== 'granted') return Azan.openNotificationSettings(); }) : k === 'exact' ? Azan.openExactAlarmSettings() : k === 'batt' ? Azan.openBatterySettings() : k === 'vol' ? Azan.raiseAlarmVolume() : Azan.openSoundSettings();
    f.catch(() => {}).then(() => setTimeout(diag, 800));
  }
  const pk = t.closest('[data-pick]');
  if (pk) Azan.pickAzan({which: pk.dataset.pick}).then(r => { toast(`✅ নতুন আযান রাখা হয়েছে: ${r.name}`); diag(); }).catch(err => { const m = err && err.message || String(err); if (!/cancel/i.test(m)) toast(m); });
  const pv = t.closest('[data-prev]');
  if (pv) Azan.test({sound: 'azan'}).catch(err => toast('আযান চালানো যায়নি: ' + (err && err.message || err)));
  const rs = t.closest('[data-reset]');
  if (rs) Azan.resetAzan({which: rs.dataset.reset}).then(() => { toast('অ্যাপের নিজস্ব আযান ফিরিয়ে আনা হয়েছে'); diag(); }).catch(() => {});
  if (e.target.closest('#azExact')) Azan.openExactAlarmSettings().catch(() => {});
  if (e.target.closest('#azBatt')) Azan.openBatterySettings().catch(() => {});
});
document.addEventListener('nz-loaded', schedule);
document.addEventListener('resume', schedule);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { schedule(); diag(); } });
document.addEventListener('resume', diag);
ui(); perms().then(diag);
})();
