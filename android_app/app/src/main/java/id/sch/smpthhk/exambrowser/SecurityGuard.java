package id.sch.smpthhk.exambrowser;

import android.app.ActivityManager;
import android.bluetooth.BluetoothAdapter;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

public class SecurityGuard {

    private static final String TAG = "SecurityGuard";
    private final MainActivity activity;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean isMonitoring = false;
    private BroadcastReceiver headsetReceiver;

    public SecurityGuard(MainActivity activity) {
        this.activity = activity;
    }

    public void startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;

        // 1. Check Floating Apps / Overlay Permission
        checkOverlayPermissions();

        // 2. Register Headset Observer
        registerHeadsetReceiver();

        // 3. Periodic Background Floating App Inspector Loop
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!isMonitoring) return;
                inspectRunningProcesses();
                handler.postDelayed(this, 3000); // inspect every 3s
            }
        }, 3000);
    }

    public void stopMonitoring() {
        isMonitoring = false;
        try {
            if (headsetReceiver != null) {
                activity.unregisterReceiver(headsetReceiver);
                headsetReceiver = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public boolean checkOverlayPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Settings.canDrawOverlays(activity)) {
                Log.w(TAG, "Floating app overlay permission detected on device!");
                return true;
            }
        }
        return false;
    }

    public boolean isBluetoothConnected() {
        try {
            BluetoothAdapter mBluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
            return mBluetoothAdapter != null && mBluetoothAdapter.isEnabled();
        } catch (Exception e) {
            return false;
        }
    }

    private void registerHeadsetReceiver() {
        try {
            headsetReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (Intent.ACTION_HEADSET_PLUG.equals(intent.getAction())) {
                        int state = intent.getIntExtra("state", -1);
                        if (state == 1) {
                            Log.i(TAG, "Headset Plugged In");
                        }
                    }
                }
            };
            IntentFilter filter = new IntentFilter(Intent.ACTION_HEADSET_PLUG);
            activity.registerReceiver(headsetReceiver, filter);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void inspectRunningProcesses() {
        try {
            ActivityManager am = (ActivityManager) activity.getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                // Keep activity brought to front if lost focus
                am.moveTaskToFront(activity.getTaskId(), ActivityManager.MOVE_TASK_WITH_HOME);
            }
        } catch (Exception e) {
            // Ignore security permission restrictions on newer Android versions
        }
    }
}
