import 'dart:convert';
import 'package:http/http.dart' as http;

/// Verifikasi PIN keluar kiosk lewat RPC server (`verify_exit_pin`).
/// PIN dibandingkan dengan bcrypt di sisi Supabase, bukan literal di Dart.
///
/// URL & anon key bersifat publik (sudah ada di bundle web yang dimuat kiosk),
/// jadi aman dikompilasi sebagai define. Nilai PIN tidak pernah ada di sini.
class ExitPinService {
  static const String _supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://sksdgnsqzazmwzboofch.supabase.co',
  );
  static const String _anonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc2RnbnNxemF6bXd6Ym9vZmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDYxNzgsImV4cCI6MjEwMjEyMjE3OH0.0rbDHxv7XsYoMjc9JPPAbHhgn-hU5wttYCHqFDJLJ9I',
  );

  /// Mengembalikan true bila PIN valid, false bila salah.
  /// Melempar [ExitPinException] untuk kegagalan jaringan/lockout.
  static Future<bool> verify(String pin) async {
    final uri = Uri.parse('$_supabaseUrl/rest/v1/rpc/verify_exit_pin');
    final resp = await http
        .post(
          uri,
          headers: {
            'apikey': _anonKey,
            'Authorization': 'Bearer $_anonKey',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'p_pin': pin}),
        )
        .timeout(const Duration(seconds: 10));

    if (resp.statusCode == 200) {
      return true;
    }

    final body = resp.body.isNotEmpty ? jsonDecode(resp.body) : null;
    final message = (body is Map && body['message'] != null)
        ? body['message'].toString()
        : 'Gagal memverifikasi PIN keluar.';
    throw ExitPinException(message, statusCode: resp.statusCode);
  }
}

class ExitPinException implements Exception {
  final String message;
  final int? statusCode;

  const ExitPinException(this.message, {this.statusCode});

  @override
  String toString() => message;
}
