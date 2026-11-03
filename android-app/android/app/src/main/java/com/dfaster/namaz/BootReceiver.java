package com.dfaster.namaz;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arms the saved azan alarms after reboot, app update, clock/time-zone change or exact-alarm permission change. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        AzanScheduler.scheduleAll(ctx);
    }
}
