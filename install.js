/* Android APK download link + in-app waqt reminders — dfaster.com/namaz */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const ua = navigator.userAgent;
const DISMISS = 'nz-apk-dismissed';
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// Android APK download (the only app on offer — no browser "install app"). Hidden inside the Android app itself.
const btn = $('#apkBtn'), bar = $('#apkBar');
if (isNativeApp) {
  [btn, bar, $('#apkLink')].forEach(e => e && e.classList.add('hidden'));
} else if (bar) {
  const dismissedAt = +localStorage.getItem(DISMISS) || 0;
  const barOn = /android/i.test(ua) && Date.now() - dismissedAt > 7 * 864e5;   // banner on Android phones, returns after 7 days
  bar.classList.toggle('hidden', !barOn);
  document.body.classList.toggle('has-bar', barOn);
  $('#apkBarX').addEventListener('click', () => {
    localStorage.setItem(DISMISS, Date.now());
    bar.classList.add('hidden'); document.body.classList.remove('has-bar');
  });
}

/* ---------- waqt reminders (only while the app/page is open) ---------- */
const KEY = 'nz-notify';
const toggle = $('#notifyToggle');
const NAMES = {Fajr: 'ফজর', Dhuhr: 'যোহর', Asr: 'আসর', Maghrib: 'মাগরিব', Isha: 'এশা'};
const GEN = {Fajr: 'ফজরের', Dhuhr: 'যোহরের', Asr: 'আসরের', Maghrib: 'মাগরিবের', Isha: 'এশার'};
// Android app: the native AzanService plays the full azan at every waqt, so the short web notification is never used there
const supported = 'Notification' in window && !isNativeApp;
if (!supported) {
  toggle.disabled = true;
  $('#notifyNote').textContent = 'এই ব্রাউজারে নোটিফিকেশন সুবিধা নেই।';
} else {
  toggle.checked = localStorage.getItem(KEY) === '1' && Notification.permission === 'granted';
  toggle.addEventListener('change', async () => {
    if (!toggle.checked) { localStorage.setItem(KEY, '0'); return; }
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') {
      toggle.checked = false; localStorage.setItem(KEY, '0');
      return window.NZ && NZ.toast('নোটিফিকেশনের অনুমতি দেওয়া হয়নি (ব্রাউজার সেটিংস থেকে চালু করুন)');
    }
    localStorage.setItem(KEY, '1');
    window.NZ && NZ.toast('চালু হয়েছে — অ্যাপ খোলা থাকলে প্রতি ওয়াক্তে জানানো হবে');
  });
}
async function notify(title, body, tag) {
  const opts = {body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: 'bn', renotify: true};
  try { new Notification(title, opts); } catch {}
}
function check() {
  if (!supported || !toggle.checked || Notification.permission !== 'granted' || !window.NZ || !NZ.today) return;
  const t = NZ.today.cur, now = Date.now();
  for (const k in NAMES) {
    const at = t[k];
    if (!at || now < at || now - at > 5 * 60000) continue;      // fire within 5 min after start
    const id = `nz-sent:${NZ.today.ymd.key}:${k}`;
    if (localStorage.getItem(id)) continue;
    localStorage.setItem(id, '1');
    notify(`${GEN[k]} ওয়াক্ত শুরু হয়েছে`, `${NZ.plain(at)} — নামাজের সময় হয়েছে। 🕌`, 'nz-' + k);
  }
  // tidy old flags
  Object.keys(localStorage).filter(x => x.startsWith('nz-sent:') && !x.includes(NZ.today.ymd.key)).forEach(x => localStorage.removeItem(x));
}
setInterval(check, 20000);
document.addEventListener('visibilitychange', check);
})();
