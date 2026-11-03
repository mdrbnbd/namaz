package com.dfaster.namaz;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/** Fired by AlarmManager at the start of a waqt (also works when the app is closed / phone locked). */
public class AzanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        long at = intent.getLongExtra("at", 0);
        // phone was off / alarm badly delayed: don't play a stale azan
        if (at > 0 && System.currentTimeMillis() - at > 15 * 60 * 1000L) { AzanService.status(ctx, "skipped: alarm fired " + ((System.currentTimeMillis() - at) / 60000) + " min late"); return; }
        Intent s = new Intent(ctx, AzanService.class)
                .putExtra("title", intent.getStringExtra("title"))
                .putExtra("body", intent.getStringExtra("body"))
                .putExtra("sound", intent.getStringExtra("sound"))
                .putExtra("test", intent.getBooleanExtra("test", false));
        try {
            ContextCompat.startForegroundService(ctx, s);
        } catch (Exception e) {
            // background start refused (e.g. inexact alarm on Android 12+): at least show the notification
            AzanService.status(ctx, "cannot start azan service: " + e);
            AzanService.ensureChannel(ctx);
            ctx.getSystemService(NotificationManager.class).notify(4244, new NotificationCompat.Builder(ctx, AzanService.CH)
                    .setSmallIcon(R.drawable.ic_stat_azan).setContentTitle("🕌 " + intent.getStringExtra("title"))
                    .setContentText(intent.getStringExtra("body")).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build());
        }
    }
}
