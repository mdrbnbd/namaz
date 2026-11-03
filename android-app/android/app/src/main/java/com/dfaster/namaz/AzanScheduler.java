package com.dfaster.namaz;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Stores the upcoming azan times (sent from the web layer) and arms one exact alarm per waqt. */
public final class AzanScheduler {
    static final String PREFS = "azan";
    private AzanScheduler() {}

    static boolean canExact(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    }

    static void save(Context ctx, JSONArray items) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putString("items", items.toString()).apply();
    }

    private static PendingIntent pi(Context ctx, int id, JSONObject it) {
        Intent i = new Intent(ctx, AzanReceiver.class).setAction("com.dfaster.namaz.AZAN");
        if (it != null) {
            i.putExtra("id", id);
            i.putExtra("at", it.optLong("at"));
            i.putExtra("title", it.optString("title", "আযান"));
            i.putExtra("body", it.optString("body", ""));
        }
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Cancels previously armed alarms and arms every saved item that is still in the future. Returns the count. */
    static int scheduleAll(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray old = new JSONArray(p.getString("armed", "[]"));
            for (int k = 0; k < old.length(); k++) am.cancel(pi(ctx, old.getInt(k), null));
        } catch (Exception ignored) {}
        JSONArray armed = new JSONArray();
        long now = System.currentTimeMillis();
        boolean exact = canExact(ctx);
        try {
            JSONArray items = new JSONArray(p.getString("items", "[]"));
            for (int k = 0; k < items.length(); k++) {
                JSONObject it = items.getJSONObject(k);
                long at = it.optLong("at");
                if (at <= now) continue;
                int id = it.optInt("id");
                PendingIntent intent = pi(ctx, id, it);
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
                armed.put(id);
            }
        } catch (Exception ignored) {}
        p.edit().putString("armed", armed.toString()).apply();
        return armed.length();
    }
}
