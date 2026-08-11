import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ExitPasswordDialog extends StatefulWidget {
  final VoidCallback onSuccess;

  const ExitPasswordDialog({Key? key, required this.onSuccess}) : super(key: key);

  @override
  State<ExitPasswordDialog> createState() => _ExitPasswordDialogState();
}

class _ExitPasswordDialogState extends State<ExitPasswordDialog> {
  final TextEditingController _passwordController = TextEditingController();
  String? _errorMsg;

  void _validatePassword() {
    final entered = _passwordController.text.trim();
    if (entered == '12345' || entered == 'THHK2026') {
      Navigator.of(context).pop();
      widget.onSuccess();
      SystemNavigator.pop();
    } else {
      setState(() {
        _errorMsg = 'Password Keamanan Salah!';
      });
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
            'Masukkan password keamanan untuk keluar dari mode ujian (Default: 12345):',
            style: TextStyle(fontSize: 12, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: 'Masukkan PIN...',
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
          onPressed: _validatePassword,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1A56DB),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('Keluar Ujian', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
