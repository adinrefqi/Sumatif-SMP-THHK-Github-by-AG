package id.sch.smpthhk.exambrowser;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.BatteryManager;
import android.webkit.JavascriptInterface;

public class WebBridge {

    private final Context context;
    private final MainActivity activity;
    private MediaPlayer mediaPlayer;

    public WebBridge(MainActivity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    @JavascriptInterface
    public int getBatteryLevel() {
        try {
            IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
            Intent batteryStatus = context.registerReceiver(null, ifilter);
            if (batteryStatus != null) {
                int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                return (int) ((level / (float) scale) * 100);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return 85; // fallback
    }

    @JavascriptInterface
    public void triggerSirenAlarm() {
        activity.runOnUiThread(() -> {
            try {
                AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int targetVolume = (int) (maxVolume * 0.95);
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVolume, 0);
                }

                if (mediaPlayer == null) {
                    // Create alarm beep sound using ToneGenerator / MediaPlayer
                    mediaPlayer = MediaPlayer.create(context, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI);
                    if (mediaPlayer == null) {
                        mediaPlayer = MediaPlayer.create(context, android.provider.Settings.System.DEFAULT_RINGTONE_URI);
                    }
                    if (mediaPlayer != null) {
                        mediaPlayer.setLooping(true);
                    }
                }

                if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
                    mediaPlayer.start();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @JavascriptInterface
    public void stopSirenAlarm() {
        activity.runOnUiThread(() -> {
            try {
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.pause();
                    mediaPlayer.seekTo(0);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @JavascriptInterface
    public void showExitPasswordDialog() {
        activity.runOnUiThread(() -> activity.promptExitPasswordDialog());
    }
}
