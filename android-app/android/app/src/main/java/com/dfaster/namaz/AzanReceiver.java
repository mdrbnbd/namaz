package com.dfaster.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Fired by AlarmManager at the start of a waqt (also works when the app is closed / phone locked). */
public class AzanReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        long at = intent.getLongExtra("at", 0);
        // phone was off / alarm badly delayed: don't play a stale azan
        if (at > 0 && System.currentTimeMillis() - at > 15 * 60 * 1000L) return;
        Intent s = new Intent(ctx, AzanService.class)
                .putExtra("title", intent.getStringExtra("title"))
                .putExtra("body", intent.getStringExtra("body"));
        ContextCompat.startForegroundService(ctx, s);
    }
}
