package com.dfaster.namaz;

import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for the native continuous Quran player (QuranService). */
@CapacitorPlugin(name = "QuranAudio")
public class QuranPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(QuranService.A_START)
                .putExtra("n", call.getInt("n", 1)).putExtra("a", call.getInt("a", 1))
                .putExtra("folder", call.getString("folder", "Alafasy_128kbps"))
                .putExtra("reciter", call.getString("reciter", ""));
        JSArray names = call.getArray("names", null);
        if (names != null && names.length() == 114) {
            String[] s = new String[114];
            for (int k = 0; k < 114; k++) s[k] = names.optString(k, String.valueOf(k + 1));
            i.putExtra("names", s);
        }
        try { QuranService.send(getContext(), i); call.resolve(state()); } catch (Exception e) { call.reject("start failed: " + e.getMessage()); }
    }
    private void cmd(PluginCall call, String a) { QuranService.send(getContext(), new Intent(a)); call.resolve(state()); }
    @PluginMethod public void toggle(PluginCall call) { cmd(call, QuranService.A_TOGGLE); }
    @PluginMethod public void pause(PluginCall call) { cmd(call, QuranService.A_PAUSE); }
    @PluginMethod public void resume(PluginCall call) { cmd(call, QuranService.A_RESUME); }
    @PluginMethod public void next(PluginCall call) { cmd(call, QuranService.A_NEXT); }
    @PluginMethod public void prev(PluginCall call) { cmd(call, QuranService.A_PREV); }
    @PluginMethod public void stop(PluginCall call) { cmd(call, QuranService.A_STOP); }
    @PluginMethod public void seek(PluginCall call) {
        QuranService.send(getContext(), new Intent(QuranService.A_SEEK).putExtra("n", call.getInt("n", 1)).putExtra("a", call.getInt("a", 1)));
        call.resolve(state());
    }
    @PluginMethod public void getState(PluginCall call) { call.resolve(state()); }

    static JSObject state() {
        JSObject r = new JSObject();
        r.put("active", QuranService.active); r.put("playing", QuranService.playing);
        r.put("n", QuranService.curN); r.put("a", QuranService.curA);
        r.put("folder", QuranService.folder); r.put("status", QuranService.status);
        r.put("local", QuranService.local); r.put("error", QuranService.lastError);
        return r;
    }
}
