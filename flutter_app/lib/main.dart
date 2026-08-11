import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:kiosk_mode/kiosk_mode.dart';
import 'services/security_service.dart';
import 'widgets/exit_password_dialog.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ExambrowserApp());
}

class ExambrowserApp extends StatelessWidget {
  const ExambrowserApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMP THHK Exambrowser',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF1A56DB),
        useMaterial3: true,
      ),
      home: const ExamScreen(),
    );
  }
}

class ExamScreen extends StatefulWidget {
  const ExamScreen({Key? key}) : super(key: key);

  @override
  State<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends State<ExamScreen> with WidgetsBindingObserver {
  InAppWebViewController? _webViewController;
  final SecurityService _securityService = SecurityService();
  static const String vercelExamUrl = "https://portal-sumatifthhk.vercel.app";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initSecurityGuard();
  }

  Future<void> _initSecurityGuard() async {
    // 1. Enable FLAG_SECURE to block Screenshots & Screen Recording
    try {
      await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
    } catch (e) {
      print("FLAG_SECURE error: $e");
    }

    // 2. Hide System Bars & Enable Immersive Sticky Mode
    await SystemChrome.setEnabledSystemUIMode(SystemUIMode.immersiveSticky);

    // 3. Enable Kiosk Mode
    try {
      await startKioskMode();
    } catch (e) {
      print("Kiosk mode error: $e");
    }

    // 4. Init Siren Audio
    await _securityService.initAudio();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.paused) {
      // Trigger Siren Alarm at 95% volume only when student actually switches away
      _securityService.playSirenAlarm();
    } else if (state == AppLifecycleState.resumed) {
      _securityService.stopSirenAlarm();
      SystemChrome.setEnabledSystemUIMode(SystemUIMode.immersiveSticky);
    }
    // Note: 'inactive' (e.g. showing the exit-password dialog) does NOT trigger
    // the siren, so the proctor can open dialogs without setting off the alarm.
  }

  void _showExitPasswordDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => ExitPasswordDialog(
        onSuccess: () async {
          await stopKioskMode();
          await FlutterWindowManager.clearFlags(FlutterWindowManager.FLAG_SECURE);
        },
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _securityService.stopSirenAlarm();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
        if (!didPop) {
          _showExitPasswordDialog();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF111827),
        body: SafeArea(
          child: InAppWebView(
            initialUrlRequest: URLRequest(url: WebUri(vercelExamUrl)),
            initialSettings: InAppWebViewSettings(
              useShouldOverrideUrlLoading: true,
              mediaPlaybackRequiresUserGesture: false,
              javaScriptEnabled: true,
              domStorageEnabled: true,
              isElementFullscreenEnabled: true,
              supportZoom: false,
            ),
            onWebViewCreated: (controller) {
              _webViewController = controller;
              
              // Add JS Handler for Native Communication
              controller.addJavaScriptHandler(
                handlerName: 'ExambrowserBridge',
                callback: (args) async {
                  if (args.isNotEmpty && args[0] == 'exit') {
                    _showExitPasswordDialog();
                  } else if (args.isNotEmpty && args[0] == 'getBattery') {
                    return await _securityService.getBatteryLevel();
                  }
                  return null;
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
