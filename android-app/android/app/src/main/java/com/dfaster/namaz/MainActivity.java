package com.dfaster.namaz;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AzanPlugin.class);
        super.onCreate(savedInstanceState);
        AzanScheduler.scheduleAll(this);   // re-arm saved alarms on every launch
        // Hardware / gesture back: walk the in-app history (tabs, surah reader) first; only leave the app from the first screen.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WebView w = bridge != null ? bridge.getWebView() : null;
                if (w != null && w.canGoBack()) { w.goBack(); return; }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
