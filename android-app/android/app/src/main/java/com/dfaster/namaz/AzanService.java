package com.dfaster.namaz;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.io.File;

/**
 * Foreground service that plays the full azan once on the ALARM stream at maximum volume.
 * Source: the user's own file (files/azan_custom_main) if chosen, else res/raw/azan(.ogg) — one azan for all five waqts.
 * v1.1.1: plays even when the phone is on silent/vibrate (it is an alarm) unless the user turned "respect silent" on;
 * never aborts on audio-focus denial; every failure is logged and stored in prefs ("last") for the in-app diagnostics.
 */
public class AzanService extends Service {
    static final String TAG = "NamazAzan";
    static final String CH = "azan_v1";
    static final String STOP = "com.dfaster.namaz.STOP_AZAN";
    private static final int NID = 4242;
    private MediaPlayer mp;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private int savedAlarmVol = -1;
    private boolean triedFallback = false;
    private String which = "main";

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CH) != null) return;
        NotificationChannel c = new NotificationChannel(CH, "আযান", NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("প্রতি ওয়াক্তে আযান (অ্যাপ বন্ধ থাকলেও)");
        c.setSound(null, null);          // the azan itself is played by MediaPlayer, in full
        c.enableVibration(true);
        c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(c);
    }

    static File customFile(Context ctx, String which) { return new File(ctx.getFilesDir(), "azan_custom_main"); }

    static void status(Context ctx, String s) {
        Log.i(TAG, s);
        ctx.getSharedPreferences(AzanScheduler.PREFS, MODE_PRIVATE).edit()
                .putString("last", s).putLong("lastAt", System.currentTimeMillis()).apply();
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { finish(); return START_NOT_STICKY; }
        ensureChannel(this);
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "আযান";
        String body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "";
        boolean test = intent != null && intent.getBooleanExtra("test", false);
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 1, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stopPi = PendingIntent.getService(this, 2, new Intent(this, AzanService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_stat_azan)
                .setContentTitle("🕌 " + title)
                .setContentText(body)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openPi)
                .setDeleteIntent(stopPi)
                .addAction(0, "আযান বন্ধ করুন", stopPi)
                .setAutoCancel(true)
                .build();
        try {
            int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
            ServiceCompat.startForeground(this, NID, n, type);
        } catch (Exception e) {
            status(this, "startForeground failed: " + e);
        }
        which = "main"; // same azan for every waqt (Fajr included)
        triedFallback = false;
        play(test);
        return START_NOT_STICKY;
    }

    private AudioAttributes attrs() {
        return new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    }

    private void play(boolean test) {
        stopPlayer();
        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        SharedPreferences p = getSharedPreferences(AzanScheduler.PREFS, MODE_PRIVATE);
        // Silent/vibrate: an azan is an alarm, so it plays by default (v1.1.0 silently skipped it — the "no sound" bug).
        if (!test && p.getBoolean("respectSilent", false) && audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) {
            status(this, "skipped: phone on silent/vibrate (respectSilent on)"); finishKeepNotification(); return;
        }
        // During a phone call do not blast the azan into the call.
        int mode = audio.getMode();
        if (!test && (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION)) {
            status(this, "skipped: phone call in progress"); finishKeepNotification(); return;
        }
        AudioAttributes aa = attrs();
        if (Build.VERSION.SDK_INT >= 26) {
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(aa)
                    .setOnAudioFocusChangeListener(fc -> {}).build();
            int r = audio.requestAudioFocus(focus);
            if (r != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) Log.w(TAG, "audio focus not granted (" + r + "), playing anyway");
        }
        // play loud: raise the ALARM stream to its maximum while the azan plays, restore the user's level afterwards
        try {
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int cur = audio.getStreamVolume(AudioManager.STREAM_ALARM);
            if (cur < max) { audio.setStreamVolume(AudioManager.STREAM_ALARM, max, 0); savedAlarmVol = cur; }
        } catch (Exception e) { Log.w(TAG, "cannot raise alarm volume: " + e); }
        File custom = customFile(this, which);
        if (custom.exists() && custom.length() > 0 && start(aa, custom, 0)) return;
        triedFallback = true;
        if (!start(aa, null, R.raw.azan)) finishKeepNotification();
    }

    /** prepares + starts a MediaPlayer from a file or a raw resource; true on success */
    private boolean start(AudioAttributes aa, File f, int res) {
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(aa);
            mp.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            if (f != null) mp.setDataSource(f.getAbsolutePath());
            else {
                try (AssetFileDescriptor afd = getResources().openRawResourceFd(res)) {
                    mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                }
            }
            mp.setOnCompletionListener(m -> { status(this, "played ok (" + which + (f != null ? ", custom" : "") + ")"); finishKeepNotification(); });
            mp.setOnErrorListener((m, w, e) -> {
                status(this, "player error " + w + "/" + e + (f != null ? " (custom file)" : ""));
                if (f != null && !triedFallback) { triedFallback = true; stopPlayerOnly(); if (start(attrs(), null, R.raw.azan)) return true; }
                finishKeepNotification(); return true;
            });
            mp.prepare();
            mp.setVolume(1f, 1f);
            mp.start();
            status(this, "playing (" + which + (f != null ? ", custom" : "") + ")");
            return true;
        } catch (Exception e) {
            status(this, "cannot play " + (f != null ? "custom file" : "bundled azan") + ": " + e);
            stopPlayerOnly();
            return false;
        }
    }

    private void stopPlayerOnly() {
        if (mp != null) { try { mp.stop(); } catch (Exception ignored) {} try { mp.release(); } catch (Exception ignored) {} mp = null; }
    }
    private void stopPlayer() {
        stopPlayerOnly();
        if (audio != null && focus != null && Build.VERSION.SDK_INT >= 26) audio.abandonAudioFocusRequest(focus);
        if (audio != null && savedAlarmVol >= 0) {
            try { audio.setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVol, 0); } catch (Exception ignored) {}
            savedAlarmVol = -1;
        }
    }
    /** azan finished: keep the notification in the shade, stop the service */
    private void finishKeepNotification() {
        stopPlayer();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
        stopSelf();
    }
    /** user pressed stop */
    private void finish() {
        stopPlayer();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
    @Override public void onDestroy() { stopPlayer(); super.onDestroy(); }
}
