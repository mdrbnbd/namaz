package com.dfaster.namaz;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/** Foreground service that plays the full azan once (res/raw/azan.ogg, or res/raw/azan_fajr.ogg when sound=="fajr"), with a "বন্ধ করুন" (stop) action. */
public class AzanService extends Service {
    static final String CH = "azan_v1";
    static final String STOP = "com.dfaster.namaz.STOP_AZAN";
    private static final int NID = 4242;
    private MediaPlayer mp;
    private AudioManager audio;
    private AudioFocusRequest focus;

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

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) { finish(); return START_NOT_STICKY; }
        ensureChannel(this);
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "আযান";
        String body = intent != null && intent.getStringExtra("body") != null ? intent.getStringExtra("body") : "";
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
        int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NID, n, type);
        play(intent != null && "fajr".equals(intent.getStringExtra("sound")) ? R.raw.azan_fajr : R.raw.azan);
        return START_NOT_STICKY;
    }

    private void play(int res) {
        stopPlayer();
        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        // respect silent / vibrate mode: show the notification only
        if (audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) { finishKeepNotification(); return; }
        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        if (Build.VERSION.SDK_INT >= 26) {
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK).setAudioAttributes(aa).build();
            if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { finishKeepNotification(); return; } // e.g. during a phone call
        }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(aa);
            mp.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mp.setDataSource(this, Uri.parse("android.resource://" + getPackageName() + "/" + res));
            mp.setOnCompletionListener(m -> finishKeepNotification());
            mp.setOnErrorListener((m, w, e) -> { finishKeepNotification(); return true; });
            mp.prepare();
            mp.start();
        } catch (Exception e) {
            finishKeepNotification();
        }
    }

    private void stopPlayer() {
        if (mp != null) { try { mp.stop(); } catch (Exception ignored) {} mp.release(); mp = null; }
        if (audio != null && focus != null && Build.VERSION.SDK_INT >= 26) audio.abandonAudioFocusRequest(focus);
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
