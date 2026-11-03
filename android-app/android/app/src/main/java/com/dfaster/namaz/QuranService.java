package com.dfaster.namaz;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.io.File;
import java.util.Locale;

/**
 * Continuous Quran recitation (native, foreground "mediaPlayback" service): ayah after ayah to the end of the surah,
 * then the next surah, ... until An-Nas (114). Stops only on the user's pause/stop. Keeps playing with the screen off
 * or the app in the background. Plays downloaded files (files/quran/<folder>/<nnn>/<aaa>.mp3, written by the
 * Capacitor Filesystem "DATA" directory) and streams the rest from everyayah.com.
 */
public class QuranService extends Service {
    static final String TAG = "NamazQuran";
    static final String CH = "quran_v1";
    static final String A_START = "start", A_TOGGLE = "toggle", A_PAUSE = "pause", A_RESUME = "resume", A_NEXT = "next", A_PREV = "prev", A_STOP = "stop", A_SEEK = "seek";
    private static final int NID = 4343;
    static final int[] COUNT = {7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6};

    // state read by QuranPlugin.state()
    static volatile boolean active = false, playing = false;
    static volatile int curN = 0, curA = 0;
    static volatile String folder = "Alafasy_128kbps", reciterName = "", status = "", lastError = "";
    static volatile boolean local = false;
    static String[] names = new String[0];

    private MediaPlayer mp;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private WifiManager.WifiLock wifi;
    private final Handler h = new Handler(Looper.getMainLooper());
    private boolean pausedByFocus = false, userPaused = false, noisyRegistered = false;
    private int errors = 0;
    private long token = 0;

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH) != null) return;
        NotificationChannel c = new NotificationChannel(CH, "কুরআন তিলাওয়াত", NotificationManager.IMPORTANCE_LOW);
        c.setDescription("তিলাওয়াত চলার সময় নিয়ন্ত্রণ (বিরতি/পরের আয়াত/বন্ধ)");
        c.setSound(null, null); c.enableVibration(false); c.setShowBadge(false);
        c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(c);
    }

    static void send(Context ctx, Intent i) {
        if (A_START.equals(i.getAction())) ContextCompat.startForegroundService(ctx, i.setClass(ctx, QuranService.class));
        else if (active) ctx.startService(i.setClass(ctx, QuranService.class));
    }

    private final BroadcastReceiver noisy = new BroadcastReceiver() {   // headphones unplugged -> pause (do not blast through the speaker)
        @Override public void onReceive(Context c, Intent i) { if (playing) { userPaused = true; pausePlayer(); } }
    };

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String act = intent != null && intent.getAction() != null ? intent.getAction() : "";
        if (!active && !A_START.equals(act)) {      // e.g. a stale notification button after the process was killed
            startFg(); stopAll(); return START_NOT_STICKY;
        }
        switch (act) {
            case A_START: {
                String f = intent.getStringExtra("folder"); if (f != null && f.matches("[A-Za-z0-9_\\-]+")) folder = f;
                String rn = intent.getStringExtra("reciter"); if (rn != null) reciterName = rn;
                String[] nm = intent.getStringArrayExtra("names"); if (nm != null && nm.length == 114) names = nm;
                int n = clamp(intent.getIntExtra("n", 1), 1, 114);
                int a = clamp(intent.getIntExtra("a", 1), 1, COUNT[n - 1]);
                active = true; userPaused = false; errors = 0;
                startFg();
                if (!requestFocus()) Log.w(TAG, "focus not granted, playing anyway");
                if (wifi == null) {
                    try { wifi = ((WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE)).createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "namaz:quran"); wifi.setReferenceCounted(false); wifi.acquire(); } catch (Exception ignored) {}
                }
                if (!noisyRegistered) { ContextCompat.registerReceiver(this, noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED); noisyRegistered = true; }
                playAyah(n, a);
                break;
            }
            case A_TOGGLE: if (playing) { userPaused = true; pausePlayer(); } else resumePlayer(); break;
            case A_PAUSE: userPaused = true; pausePlayer(); break;
            case A_RESUME: resumePlayer(); break;
            case A_NEXT: next(); break;
            case A_PREV: prev(); break;
            case A_SEEK: { int n = clamp(intent.getIntExtra("n", curN), 1, 114); playAyah(n, clamp(intent.getIntExtra("a", 1), 1, COUNT[n - 1])); break; }
            case A_STOP: default: stopAll(); break;
        }
        return START_NOT_STICKY;
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }

    private AudioAttributes attrs() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    }

    private final AudioManager.OnAudioFocusChangeListener focusL = fc -> {
        if (fc == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) { if (playing) { pausedByFocus = true; pausePlayer(); } }     // phone call, azan, navigation
        else if (fc == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) { if (mp != null) try { mp.setVolume(0.25f, 0.25f); } catch (Exception ignored) {} }
        else if (fc == AudioManager.AUDIOFOCUS_GAIN) { if (mp != null) try { mp.setVolume(1f, 1f); } catch (Exception ignored) {} if (pausedByFocus && !userPaused) { pausedByFocus = false; resumePlayer(); } }
        else if (fc == AudioManager.AUDIOFOCUS_LOSS) { if (playing) { pausedByFocus = true; pausePlayer(); } }        // another player took over: pause, resume if it gives focus back
    };

    private boolean requestFocus() {
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            if (focus == null) focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attrs())
                    .setOnAudioFocusChangeListener(focusL, h).setWillPauseWhenDucked(false).build();
            return audio.requestAudioFocus(focus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        return audio.requestAudioFocus(focusL, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    static File localFile(Context ctx, String folder, int n, int a) {
        return new File(ctx.getFilesDir(), String.format(Locale.US, "quran/%s/%03d/%03d.mp3", folder, n, a));
    }

    private void releasePlayer() {
        if (mp != null) { MediaPlayer m = mp; mp = null; try { m.reset(); } catch (Exception ignored) {} try { m.release(); } catch (Exception ignored) {} }
    }

    private void playAyah(int n, int a) {
        h.removeCallbacksAndMessages(null);
        releasePlayer();
        curN = n; curA = a; status = "loading"; playing = true; pausedByFocus = false;
        getSharedPreferences(AzanScheduler.PREFS, MODE_PRIVATE).edit().putInt("qN", n).putInt("qA", a).apply();
        final long my = ++token;
        File f = localFile(this, folder, n, a);
        local = f.exists() && f.length() > 0;
        try {
            MediaPlayer m = new MediaPlayer(); mp = m;
            m.setAudioAttributes(attrs());
            m.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            if (local) m.setDataSource(f.getAbsolutePath());
            else m.setDataSource(String.format(Locale.US, "https://everyayah.com/data/%s/%03d%03d.mp3", folder, n, a));
            m.setOnPreparedListener(p -> {
                if (my != token) return;
                errors = 0; status = "playing"; lastError = "";
                if (userPaused || pausedByFocus) { playing = false; status = "paused"; updateNotif(); return; }
                p.start(); playing = true; updateNotif();
            });
            m.setOnCompletionListener(p -> { if (my == token) next(); });
            m.setOnErrorListener((p, w, e) -> { if (my == token) onError("player " + w + "/" + e); return true; });
            m.prepareAsync();
        } catch (Exception e) {
            onError(e.toString());
        }
        updateNotif();
    }

    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
            return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) { return true; }
    }

    /** never gives up on its own: offline -> wait for the internet and retry; a single bad file -> retry once, then skip it */
    private void onError(String why) {
        Log.w(TAG, "error " + curN + ":" + curA + " " + why);
        lastError = why; errors++;
        releasePlayer();
        final int n = curN, a = curA;
        if (!local && !online()) {
            status = "waiting-net"; updateNotif();
            h.postDelayed(() -> { if (active && !userPaused) playAyah(n, a); }, 5000);
            return;
        }
        if (errors <= 2) { status = "retry"; updateNotif(); h.postDelayed(() -> { if (active && !userPaused) playAyah(n, a); }, 1500); return; }
        errors = 0;
        h.postDelayed(() -> { if (active && !userPaused) next(); }, 300);
    }

    private void next() {
        int n = curN, a = curA + 1;
        if (n < 1) n = 1;
        if (a > COUNT[n - 1]) { n++; a = 1; }
        if (n > 114) { status = "done"; stopAll(); return; }   // finished the whole Quran
        userPaused = false;
        playAyah(n, a);
    }
    private void prev() {
        int n = curN, a = curA - 1;
        if (a < 1) { if (n > 1) { n--; a = COUNT[n - 1]; } else a = 1; }
        userPaused = false;
        playAyah(n, a);
    }
    private void pausePlayer() {
        if (mp != null) try { if (mp.isPlaying()) mp.pause(); } catch (Exception ignored) {}
        playing = false; status = "paused"; updateNotif();
    }
    private void resumePlayer() {
        userPaused = false; pausedByFocus = false;
        requestFocus();
        if (mp != null && "paused".equals(status)) { try { mp.start(); playing = true; status = "playing"; updateNotif(); return; } catch (Exception ignored) {} }
        playAyah(curN > 0 ? curN : 1, curA > 0 ? curA : 1);
    }

    private String surahName(int n) { return names.length == 114 && names[n - 1] != null ? names[n - 1] : String.valueOf(n); }
    static String bn(int v) { String d = "০১২৩৪৫৬৭৮৯"; StringBuilder s = new StringBuilder(); for (char c : String.valueOf(v).toCharArray()) s.append(Character.isDigit(c) ? d.charAt(c - '0') : c); return s.toString(); }

    private PendingIntent act(String a, int rc) {
        return PendingIntent.getService(this, rc, new Intent(this, QuranService.class).setAction(a), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private Notification build() {
        ensureChannel(this);
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 11, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String t = curN > 0 ? "📖 সূরা " + surahName(curN) + " — আয়াত " + bn(curA) + "/" + bn(COUNT[curN - 1]) : "📖 কুরআন তিলাওয়াত";
        String sub = "waiting-net".equals(status) ? "ইন্টারনেটের অপেক্ষায়… (ডাউনলোড করা সূরা অফলাইনে চলে)" : "paused".equals(status) ? "বিরতি — ▶ চাপুন" : (reciterName.isEmpty() ? "" : reciterName) + (local ? " · অফলাইন" : "");
        return new NotificationCompat.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_stat_azan)
                .setContentTitle(t).setContentText(sub)
                .setContentIntent(openPi)
                .setOngoing(playing).setOnlyAlertOnce(true).setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDeleteIntent(act(A_STOP, 25))
                .addAction(0, "⏮", act(A_PREV, 21))
                .addAction(0, playing ? "⏸ বিরতি" : "▶ চালু", act(A_TOGGLE, 22))
                .addAction(0, "⏭", act(A_NEXT, 23))
                .addAction(0, "✕ বন্ধ", act(A_STOP, 24))
                .build();
    }
    private void startFg() {
        try {
            int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
            ServiceCompat.startForeground(this, NID, build(), type);
        } catch (Exception e) { Log.w(TAG, "startForeground " + e); }
    }
    private void updateNotif() {
        if (!active) return;
        try { getSystemService(NotificationManager.class).notify(NID, build()); } catch (Exception ignored) {}
    }

    private void stopAll() {
        h.removeCallbacksAndMessages(null);
        token++;
        releasePlayer();
        active = false; playing = false; if (!"done".equals(status)) status = "stopped";
        if (audio != null) { if (Build.VERSION.SDK_INT >= 26 && focus != null) audio.abandonAudioFocusRequest(focus); else audio.abandonAudioFocus(focusL); }
        if (wifi != null) { try { wifi.release(); } catch (Exception ignored) {} wifi = null; }
        if (noisyRegistered) { try { unregisterReceiver(noisy); } catch (Exception ignored) {} noisyRegistered = false; }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
    @Override public void onDestroy() { if (active) stopAll(); super.onDestroy(); }
}
