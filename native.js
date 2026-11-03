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
  ['#apkLink', '#notifyRow', '#installBtn', '#installBar'].forEach(s => { const e = $(s); if (e) e.classList.add('hidden'); });
  $('#azanSet').classList.remove('hidden');
  const on = get();
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
      return {id: Math.floor(x.ts / 60000) % 2000000000, at: x.ts, title: `${w[2]} আযান`, body: `${w[2]} ওয়াক্ত শুরু — ${place} ${hm(x.ts)}`};
    });
    const r = await Azan.schedule({items});
    for (const [k] of W) {
      const nx = list.find(x => x.k === k), el = $('#azn-' + k);
      if (el) el.textContent = on[k] ? (nx ? `পরের আযান: ${new Date(nx.ts).toDateString() === new Date().toDateString() ? 'আজ' : 'আগামীকাল'} ${hm(nx.ts)}` : '—') : 'বন্ধ';
    }
    const exact = r && r.exact;
    $('#azanNote').innerHTML = `${bn(items.length)}টি আযান সেট আছে (পরের ${bn(DAYS)} দিন, ${place})। অ্যাপ খুললেই সময় নতুন করে হালনাগাদ হয়। ফোন সাইলেন্ট/ভাইব্রেট মোডে থাকলে শুধু নোটিফিকেশন আসবে, আযান বাজবে না।` +
      (exact === false ? ' <b>⚠️ “অ্যালার্ম ও রিমাইন্ডার” অনুমতি বন্ধ — আযান কয়েক মিনিট দেরিতে বাজতে পারে।</b> <button class="chip" id="azExact">অনুমতি দিন</button>' : '') +
      ' কিছু ফোনে (Xiaomi, Oppo, Vivo, Samsung) ব্যাটারি সেভার অ্যাপ বন্ধ করে দেয় — <button class="chip" id="azBatt">ব্যাটারি সেটিং</button> থেকে এই অ্যাপকে “Unrestricted/No restriction” করুন।';
  } catch (e) {
    $('#azanNote').textContent = 'আযান সেট করা যায়নি: ' + (e && e.message || e) + ' — ইন্টারনেট চালু করে অ্যাপটি আবার খুলুন।';
  } finally {
    busy = false; if (again) { again = false; schedule(); }
  }
}
async function perms() {
  try { const p = await Azan.checkPermissions(); if (p.notifications !== 'granted') await Azan.requestPermissions(); } catch {}
}
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.k; if (!k || !e.target.closest('#azanToggles')) return;
  const v = get(); v[k] = e.target.checked; set(v); schedule();
});
document.addEventListener('click', e => {
  if (e.target.closest('#azanTest')) Azan.test().catch(() => {});
  if (e.target.closest('#azExact')) Azan.openExactAlarmSettings().catch(() => {});
  if (e.target.closest('#azBatt')) Azan.openBatterySettings().catch(() => {});
});
document.addEventListener('nz-loaded', schedule);
document.addEventListener('resume', schedule);
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
ui(); perms();
})();
