package id.sch.smpthhk.exambrowser;

import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private WebBridge webBridge;
    private SecurityGuard securityGuard;

    // Vercel Production URL or Fallback Local Asset
    private static final String VERCEL_EXAM_URL = "https://sumatif-smp-thhk.vercel.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. FLAG_SECURE: Block Screenshots & Screen Recording
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );

        // 2. Hide System Bars & Immersive Fullscreen (Android 14+ SDK 34 Compatible)
        hideSystemUI();

        // 3. LockTask Kiosk Mode
        try {
            startLockTask();
        } catch (Exception e) {
            e.printStackTrace();
        }

        setContentView(R.layout.activity_main);

        // 4. Initialize WebView
        initWebView();

        // 5. Initialize Security Monitoring
        securityGuard = new SecurityGuard(this);
        securityGuard.startMonitoring();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebView() {
        webView = findViewById(R.id.webView);
        WebSettings webSettings = webView.getSettings();

        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);

        // Bind JS Bridge Interface
        webBridge = new WebBridge(this);
        webView.addJavascriptInterface(webBridge, "ExambrowserBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        // Load Vercel Cloud Exam App
        webView.loadUrl(VERCEL_EXAM_URL);
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Trigger Siren Warning Sound at 95% volume when student tries to switch apps
        if (webBridge != null) {
            webBridge.triggerSirenAlarm();
        }
        Toast.makeText(this, "PERINGATAN: Dilarang keluar dari aplikasi Ujian Sumatif!", Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webBridge != null) {
            webBridge.triggerSirenAlarm();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        if (webBridge != null) {
            webBridge.stopSirenAlarm();
        }
    }

    @Override
    public void onBackPressed() {
        // Prevent default Back button action - prompt password dialog instead
        promptExitPasswordDialog();
    }

    public void promptExitPasswordDialog() {
        ExitPasswordDialog.show(this, new ExitPasswordDialog.OnPasswordValidatedListener() {
            @Override
            public void onSuccess() {
                try {
                    stopLockTask();
                } catch (Exception e) {}
                Toast.makeText(MainActivity.this, "Berhasil keluar dari mode ujian.", Toast.LENGTH_SHORT).show();
                finishAndRemoveTask();
                android.os.Process.killProcess(android.os.Process.myPid());
            }

            @Override
            public void onFailure() {
                Toast.makeText(MainActivity.this, "Password Keamanan Salah!", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onDestroy() {

        if (securityGuard != null) {
            securityGuard.stopMonitoring();
        }
        super.onDestroy();
    }
}
