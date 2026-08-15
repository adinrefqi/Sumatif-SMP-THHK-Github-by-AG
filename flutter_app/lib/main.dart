import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:kiosk_mode/kiosk_mode.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'services/security_service.dart';
import 'services/violation_log_service.dart';
import 'widgets/exit_password_dialog.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ExambrowserApp());
}

class ExambrowserApp extends StatelessWidget {
  const ExambrowserApp({super.key});

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
  const ExamScreen({super.key});

  @override
  State<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends State<ExamScreen> with WidgetsBindingObserver {
  InAppWebViewController? _webViewController;
  final SecurityService _securityService = SecurityService();
  final ViolationLogService _violationLogService = ViolationLogService();
  static const String vercelExamUrl = "https://portal-sumatifthhk.vercel.app";
  bool _isViolationHandling = false;
  bool _isExitDialogOpen = false;
  bool _isNormalExit = false;
  bool _kioskWatchActive = false;
  DateTime? _lastPausedAt;
  String? _currentSessionId;
  String? _currentStudentId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initSecurityGuard();
  }

  Future<void> _initSecurityGuard() async {
    // 1. Hide System Bars & Enable Immersive Sticky Mode
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    // 2. Enable Wakelock & Set Brightness to 50%
    try {
      WakelockPlus.enable();
      await ScreenBrightness().setScreenBrightness(0.5);
    } catch (e) {
      print("Screen brightness/wakelock error: $e");
    }

    // 3. Enable Kiosk Mode
    try {
      await startKioskMode();
    } catch (e) {
      print("Kiosk mode error: $e");
    }

    // 4. Init Siren Audio
    await _securityService.initAudio();

    // 5. Listen to Kiosk Mode changes.
    // NOTE: startLockTask() is posted asynchronously on Android, so the first
    // query of watchKioskMode() can still report "disabled" while pinning is
    // starting. Ignore events during the startup grace period to avoid a false
    // violation that kills the app right after launch.
    // Kebijakan: begitu sematan (LockTask) terlepas, aplikasi di-force close
    // supaya siswa tidak bisa lanjut pakai aplikasi di luar mode kiosk.
    watchKioskMode().listen((mode) {
      if (!_kioskWatchActive) return;
      if (mode == KioskMode.disabled && !_isExitDialogOpen && !_isNormalExit) {
        _forceCloseApp('kiosk_disabled');
      }
    });
    Timer(const Duration(seconds: 10), () {
      _kioskWatchActive = true;
    });
  }

  Future<void> _forceCloseApp(String type, [String detail = '']) async {
    if (_isViolationHandling) return;
    _isViolationHandling = true;

    // Catat pelanggaran dulu (best effort) sebelum mematikan proses.
    await _violationLogService.appendViolation({
      'type': type,
      'detail': detail,
      'sessionId': _currentSessionId,
      'studentId': _currentStudentId,
    });

    _securityService.stopSirenAlarm();
    try {
      await stopKioskMode();
    } catch (_) {}
    if (Platform.isAndroid) {
      SystemNavigator.pop();
    }
    exit(0);
  }

  Future<void> _handleViolation(String type, [String detail = '']) async {
    if (_isViolationHandling) return;
    _isViolationHandling = true;

    // BYOD strategy: never auto-kill. Log the violation natively, play a short
    // siren as deterrence, then keep the app alive so the heartbeat continues.
    await _violationLogService.appendViolation({
      'type': type,
      'detail': detail,
      'sessionId': _currentSessionId,
      'studentId': _currentStudentId,
    });

    // Short deterrence siren (not the 3s kill sequence)
    _securityService.playSirenAlarm();
    await Future.delayed(const Duration(seconds: 2));
    _securityService.stopSirenAlarm();

    _isViolationHandling = false;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.paused) {
      // Ignore pauses during the startup grace period (e.g. screen pinning
      // confirmation dialog). After that, a long pause means the user left the
      // exam app. Log as violation + short siren (NO auto-kill — BYOD).
      if (!_kioskWatchActive) return;
      _lastPausedAt = DateTime.now();
      Timer(const Duration(seconds: 4), () {
        if (mounted &&
            _kioskWatchActive &&
            _lastPausedAt != null &&
            DateTime.now().difference(_lastPausedAt!) >= const Duration(seconds: 4) &&
            !_isExitDialogOpen &&
            !_isViolationHandling) {
          _handleViolation('app_background');
        }
      });
    } else if (state == AppLifecycleState.resumed) {
      _lastPausedAt = null;
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  void _showExitPasswordDialog() {
    _isExitDialogOpen = true;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => ExitPasswordDialog(
        onSuccess: () async {
          _isExitDialogOpen = false;
          _isNormalExit = true;
          // Normal exit, stop kiosk and exit smoothly without alarm
          await stopKioskMode();
          if (Platform.isAndroid) {
            SystemNavigator.pop();
          }
          exit(0);
        },
      ),
    ).then((_) {
      _isExitDialogOpen = false;
    });
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
              javaScriptCanOpenWindowsAutomatically: false,
            ),
            // #6 Allowlist URL: kiosk hanya boleh navigasi ke portal ujian.
            // iframe Google Drive / window baru diblokir, jadi siswa tidak
            // bisa keluar ke internet lewat UI Drive di dalam WebView.
            shouldOverrideUrlLoading: (controller, action) async {
              final host = action.request.url?.host ?? '';
              const allowed = {'portal-sumatifthhk.vercel.app'};
              return allowed.contains(host)
                  ? NavigationActionPolicy.ALLOW
                  : NavigationActionPolicy.CANCEL;
            },
            onCreateWindow: (controller, createWindowAction) async => false,
            onWebViewCreated: (controller) {
              _webViewController = controller;
              
              // Add JS Handler for Native Communication
              controller.addJavaScriptHandler(
                handlerName: 'ExambrowserBridge',
                callback: (args) async {
                  if (args.isEmpty) return null;
                  final command = args[0];
                  final payload = (args.length > 1 && args[1] is Map)
                      ? (args[1] as Map).cast<String, dynamic>()
                      : <String, dynamic>{};

                  if (command == 'exit') {
                    _showExitPasswordDialog();
                  } else if (command == 'getBattery') {
                    return await _securityService.getBatteryLevel();
                  } else if (command == 'heartbeat') {
                    // Remember session identity from the web side
                    if (payload['sessionId'] is String) {
                      _currentSessionId = payload['sessionId'] as String;
                    }
                    if (payload['studentId'] is String) {
                      _currentStudentId = payload['studentId'] as String;
                    }
                    await _violationLogService.appendHeartbeat(payload);
                    return true;
                  } else if (command == 'violation') {
                    await _violationLogService.appendViolation({
                      'type': payload['type'] ?? 'unknown',
                      'detail': payload['detail'] ?? '',
                      'sessionId': _currentSessionId,
                      'studentId': _currentStudentId,
                    });
                    return true;
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
