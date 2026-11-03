package com.dfaster.namaz;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.database.Cursor;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONArray;

@CapacitorPlugin(name = "Azan", permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
})
public class AzanPlugin extends Plugin {
    static final int TEST_ID = 1999999999;
    static final long MAX_CUSTOM = 30L * 1024 * 1024;

    private String notifState() {
        if (Build.VERSION.SDK_INT < 33) return "granted";
        return getPermissionState("notifications") == PermissionState.GRANTED ? "granted" : getPermissionState("notifications").toString();
    }

    @Override @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject r = new JSObject(); r.put("notifications", notifState()); call.resolve(r);
    }

    @Override @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) { checkPermissions(call); return; }
        requestPermissionForAlias("notifications", call, "permCb");
    }

    @PermissionCallback
    private void permCb(PluginCall call) { checkPermissions(call); }

    /** items: [{id, at (epoch ms), title, body, sound ("fajr"|"azan")}] — replaces the whole schedule */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        try { AzanScheduler.save(getContext(), new JSONArray(items.toString())); } catch (Exception e) { call.reject("bad items"); return; }
        int n = AzanScheduler.scheduleAll(getContext());
        AzanService.ensureChannel(getContext());
        JSObject r = new JSObject();
        r.put("count", n);
        r.put("exact", AzanScheduler.canExact(getContext()));
        call.resolve(r);
    }

    /** plays the azan right now (preview) */
    @PluginMethod
    public void test(PluginCall call) {
        Intent s = new Intent(getContext(), AzanService.class).putExtra("title", "আযান (পরীক্ষা)").putExtra("body", "আযান ঠিকমতো বাজছে কিনা দেখুন")
                .putExtra("sound", call.getString("sound", "azan")).putExtra("test", true);
        try { ContextCompat.startForegroundService(getContext(), s); call.resolve(); }
        catch (Exception e) { AzanService.status(getContext(), "test failed: " + e); call.reject(e.toString()); }
    }

    /** arms a real AlarmManager alarm in `seconds` (default 60) — tests the whole path: alarm -> receiver -> service, with the app closed */
    @PluginMethod
    public void testIn(PluginCall call) {
        int sec = Math.max(10, call.getInt("seconds", 60));
        long at = System.currentTimeMillis() + sec * 1000L;
        Context ctx = getContext();
        Intent i = new Intent(ctx, AzanReceiver.class).setAction("com.dfaster.namaz.AZAN_TEST")
                .putExtra("at", at).putExtra("title", "আযান (১ মিনিটের পরীক্ষা)").putExtra("body", "ওয়াক্তের আযান এভাবেই বাজবে")
                .putExtra("sound", call.getString("sound", "azan")).putExtra("test", false);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, TEST_ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        boolean exact = AzanScheduler.canExact(ctx);
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        AzanService.status(ctx, "test alarm armed for +" + sec + "s");
        JSObject r = new JSObject(); r.put("at", at); r.put("exact", exact); call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().startService(new Intent(getContext(), AzanService.class).setAction(AzanService.STOP));
        call.resolve();
    }

    /** everything that can make the azan silent, for the in-app checklist */
    @PluginMethod
    public void diagnostics(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        boolean notifOn = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        r.put("notifications", notifOn);
        boolean chOn = true;
        if (Build.VERSION.SDK_INT >= 26) {
            AzanService.ensureChannel(ctx);
            NotificationChannel c = ctx.getSystemService(NotificationManager.class).getNotificationChannel(AzanService.CH);
            chOn = c == null || c.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        r.put("channel", chOn);
        r.put("exact", AzanScheduler.canExact(ctx));
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        r.put("battery", Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        r.put("alarmVol", am.getStreamVolume(AudioManager.STREAM_ALARM));
        r.put("alarmMax", am.getStreamMaxVolume(AudioManager.STREAM_ALARM));
        r.put("mediaVol", am.getStreamVolume(AudioManager.STREAM_MUSIC));
        r.put("mediaMax", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        r.put("ringer", am.getRingerMode() == AudioManager.RINGER_MODE_NORMAL ? "normal" : am.getRingerMode() == AudioManager.RINGER_MODE_VIBRATE ? "vibrate" : "silent");
        int dnd = Build.VERSION.SDK_INT >= 23 ? ctx.getSystemService(NotificationManager.class).getCurrentInterruptionFilter() : 1;
        r.put("dnd", dnd > NotificationManager.INTERRUPTION_FILTER_ALL);
        SharedPreferences p = ctx.getSharedPreferences(AzanScheduler.PREFS, Context.MODE_PRIVATE);
        r.put("respectSilent", p.getBoolean("respectSilent", false));
        r.put("last", p.getString("last", ""));
        r.put("lastAt", p.getLong("lastAt", 0));
        try { r.put("armed", new JSONArray(p.getString("armed", "[]")).length()); } catch (Exception e) { r.put("armed", 0); }
        r.put("customMain", customInfo(ctx, "main"));
        r.put("customFajr", customInfo(ctx, "fajr"));
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("maker", Build.MANUFACTURER);
        call.resolve(r);
    }
    private static String customInfo(Context ctx, String which) {
        File f = AzanService.customFile(ctx, which);
        if (!f.exists() || f.length() == 0) return "";
        return ctx.getSharedPreferences(AzanScheduler.PREFS, Context.MODE_PRIVATE).getString("customName_" + which, "নিজের ফাইল");
    }

    @PluginMethod
    public void setRespectSilent(PluginCall call) {
        getContext().getSharedPreferences(AzanScheduler.PREFS, Context.MODE_PRIVATE).edit().putBoolean("respectSilent", call.getBoolean("value", false)).apply();
        call.resolve();
    }

    @PluginMethod
    public void raiseAlarmVolume(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        try { am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), AudioManager.FLAG_SHOW_UI); } catch (Exception ignored) {}
        try { am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(am.getStreamVolume(AudioManager.STREAM_MUSIC), am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) * 2 / 3), 0); } catch (Exception ignored) {}
        call.resolve();
    }

    private void open(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) open(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()));
        else open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void openSoundSettings(PluginCall call) {
        open(new Intent(Settings.ACTION_SOUND_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }

    // ---------- own azan file (copied into app-private storage, so it keeps working even if the original is moved) ----------
    @PluginMethod
    public void pickAzan(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("audio/*");
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("cancelled"); return; }
        Uri uri = result.getData().getData();
        String which = "fajr".equals(call.getString("which")) ? "fajr" : "main";
        Context ctx = getContext();
        String name = "নিজের ফাইল";
        try (Cursor c = ctx.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {}
        File tmp = new File(ctx.getFilesDir(), "azan_custom_tmp");
        try (InputStream in = ctx.getContentResolver().openInputStream(uri); OutputStream out = new FileOutputStream(tmp)) {
            byte[] b = new byte[65536]; long tot = 0; int k;
            while ((k = in.read(b)) > 0) { tot += k; if (tot > MAX_CUSTOM) throw new Exception("ফাইলটি ৩০ MB-এর বেশি বড়"); out.write(b, 0, k); }
        } catch (Exception e) { tmp.delete(); call.reject("ফাইল কপি করা যায়নি: " + e.getMessage()); return; }
        // verify Android can actually decode it before accepting
        android.media.MediaPlayer mp = new android.media.MediaPlayer();
        int ms;
        try { mp.setDataSource(tmp.getAbsolutePath()); mp.prepare(); ms = mp.getDuration(); }
        catch (Exception e) { tmp.delete(); call.reject("এই অডিও ফাইলটি চালানো যায় না — MP3/M4A/OGG ফাইল বেছে নিন"); return; }
        finally { mp.release(); }
        File dst = AzanService.customFile(ctx, which);
        dst.delete();
        if (!tmp.renameTo(dst)) { tmp.delete(); call.reject("ফাইল রাখা যায়নি"); return; }
        ctx.getSharedPreferences(AzanScheduler.PREFS, Context.MODE_PRIVATE).edit().putString("customName_" + which, name).apply();
        JSObject r = new JSObject(); r.put("which", which); r.put("name", name); r.put("durationMs", ms);
        call.resolve(r);
    }

    @PluginMethod
    public void resetAzan(PluginCall call) {
        String which = "fajr".equals(call.getString("which")) ? "fajr" : "main";
        AzanService.customFile(getContext(), which).delete();
        getContext().getSharedPreferences(AzanScheduler.PREFS, Context.MODE_PRIVATE).edit().remove("customName_" + which).apply();
        call.resolve();
    }
}
