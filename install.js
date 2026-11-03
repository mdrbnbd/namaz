/* App install (PWA) + in-app waqt reminders — dfaster.com/namaz */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const DISMISS = 'nz-install-dismissed';
let deferred = null;

function show(on) {
  $('#installBtn').classList.toggle('hidden', !on);
  const dismissedAt = +localStorage.getItem(DISMISS) || 0;
  const barOn = on && Date.now() - dismissedAt > 7 * 864e5;   // banner returns after 7 days
  $('#installBar').classList.toggle('hidden', !barOn);
  document.body.classList.toggle('has-bar', barOn);
}
function hideAll() { show(false); }

async function doInstall() {
  if (deferred) {
    deferred.prompt();
    const {outcome} = await deferred.userChoice.catch(() => ({}));
    deferred = null;
    if (outcome === 'accepted') { hideAll(); window.NZ && NZ.toast('ইনস্টল হচ্ছে — হোম স্ক্রিনে আইকন দেখুন'); }
    else show(false), $('#installBtn').classList.remove('hidden');
    return;
  }
  if (isIOS) { $('#iosSheet').classList.remove('hidden'); return; }
  window.NZ && NZ.toast('ব্রাউজারের মেনু (⋮) থেকে “Install app” / “Add to Home screen” চাপুন');
}

if (isStandalone()) hideAll();
else if (isIOS) show(true);                 // iOS Safari has no install prompt: show the guide instead

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
  if (!isStandalone()) show(true);
});
window.addEventListener('appinstalled', () => { deferred = null; hideAll(); });
matchMedia('(display-mode: standalone)').addEventListener?.('change', e => { if (e.matches) hideAll(); });
// already installed (Chrome on Android, related apps)
if (navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then(l => { if (l && l.length) hideAll(); }).catch(() => {});

$('#installBtn').addEventListener('click', doInstall);
$('#installBarBtn').addEventListener('click', doInstall);
$('#installBarX').addEventListener('click', () => {
  localStorage.setItem(DISMISS, Date.now());
  $('#installBar').classList.add('hidden'); document.body.classList.remove('has-bar');
});
$('#iosClose').addEventListener('click', () => $('#iosSheet').classList.add('hidden'));
$('#iosSheet').addEventListener('click', e => { if (e.target.id === 'iosSheet') e.target.classList.add('hidden'); });

/* ---------- waqt reminders (only while the app/page is open) ---------- */
const KEY = 'nz-notify';
const toggle = $('#notifyToggle');
const NAMES = {Fajr: 'ফজর', Dhuhr: 'যোহর', Asr: 'আসর', Maghrib: 'মাগরিব', Isha: 'এশা'};
const GEN = {Fajr: 'ফজরের', Dhuhr: 'যোহরের', Asr: 'আসরের', Maghrib: 'মাগরিবের', Isha: 'এশার'};
const supported = 'Notification' in window;
if (!supported) {
  toggle.disabled = true;
  $('#notifyNote').textContent = isIOS && !isStandalone()
    ? 'আইফোনে নোটিফিকেশনের জন্য আগে অ্যাপটি হোম স্ক্রিনে ইনস্টল করুন। এটি শুধু অ্যাপ খোলা থাকলে কাজ করে।'
    : 'এই ব্রাউজারে নোটিফিকেশন সুবিধা নেই।';
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
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) return reg.showNotification(title, opts);   // required on Android Chrome
    new Notification(title, opts);
  } catch {}
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
