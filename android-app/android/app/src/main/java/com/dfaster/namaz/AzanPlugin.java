package com.dfaster.namaz;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;

@CapacitorPlugin(name = "Azan", permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
})
public class AzanPlugin extends Plugin {

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

    /** items: [{id, at (epoch ms), title, body}] — replaces the whole schedule */
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

    @PluginMethod
    public void test(PluginCall call) {
        Intent s = new Intent(getContext(), AzanService.class).putExtra("title", "আযান (পরীক্ষা)").putExtra("body", "আযান ঠিকমতো বাজছে কিনা দেখুন");
        ContextCompat.startForegroundService(getContext(), s);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().startService(new Intent(getContext(), AzanService.class).setAction(AzanService.STOP));
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) {
            getContext().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }
}
