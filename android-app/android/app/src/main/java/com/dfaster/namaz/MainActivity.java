package com.dfaster.namaz;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AzanPlugin.class);
        super.onCreate(savedInstanceState);
        AzanScheduler.scheduleAll(this);   // re-arm saved alarms on every launch
    }
}
