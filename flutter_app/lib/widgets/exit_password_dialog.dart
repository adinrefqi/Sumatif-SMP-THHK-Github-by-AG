import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/exit_pin_service.dart';

class ExitPasswordDialog extends StatefulWidget {
  final VoidCallback onSuccess;

  const ExitPasswordDialog({super.key, required this.onSuccess});

  @override
  State<ExitPasswordDialog> createState() => _ExitPasswordDialogState();
}

class _ExitPasswordDialogState extends State<ExitPasswordDialog> {
  final TextEditingController _passwordController = TextEditingController();
  String? _errorMsg;
  bool _isVerifying = false;
  int _failedAttempts = 0;
  Timer? _lockoutTimer;
  int _lockoutRemaining = 0;

  static const int _maxAttempts = 3;
  static const int _lockoutSeconds = 60;

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    _passwordController.dispose();
    super.dispose();
  }

  bool get _isLocked => _lockoutRemaining > 0;

  void _startLockout() {
    _lockoutRemaining = _lockoutSeconds;
    _lockoutTimer?.cancel();
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        _lockoutRemaining -= 1;
        if (_lockoutRemaining <= 0) {
          _lockoutRemaining = 0;
          _failedAttempts = 0;
          _errorMsg = null;
          timer.cancel();
        }
      });
    });
  }

  Future<void> _validatePassword() async {
    if (_isLocked || _isVerifying) return;

    final entered = _passwordController.text.trim();
    if (entered.isEmpty) {
      setState(() => _errorMsg = 'Masukkan PIN keluar.');
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMsg = null;
    });

    try {
      final ok = await ExitPinService.verify(entered);
      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop();
        widget.onSuccess();
        SystemNavigator.pop();
        return;
      }
      setState(() {
        _failedAttempts += 1;
        _errorMsg = 'Password Keamanan Salah!';
      });
    } catch (e) {
      if (!mounted) return;
      final message = e is ExitPinException
          ? e.message
          : 'Tidak dapat terhubung ke server. Coba lagi.';
      setState(() {
        _failedAttempts += 1;
        _errorMsg = message;
      });
    } finally {
      if (mounted) {
        setState(() => _isVerifying = false);
        if (_failedAttempts >= _maxAttempts && !_isLocked) {
          _startLockout();
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        children: [
          Icon(Icons.security, color: Color(0xFF1A56DB)),
          SizedBox(width: 8),
          Text(
            'Password Exit Admin',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Masukkan password keamanan untuk keluar dari mode ujian:',
            style: TextStyle(fontSize: 12, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            keyboardType: TextInputType.number,
            enabled: !_isLocked && !_isVerifying,
            decoration: InputDecoration(
              hintText: _isLocked
                  ? 'Terkunci $_lockoutRemaining detik...'
                  : 'Masukkan PIN...',
              errorText: _errorMsg,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Batal'),
        ),
        ElevatedButton(
          onPressed: (_isLocked || _isVerifying) ? null : _validatePassword,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1A56DB),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(
            _isVerifying ? 'Memeriksa...' : 'Keluar Ujian',
            style: const TextStyle(color: Colors.white),
          ),
        ),
      ],
    );
  }
}
