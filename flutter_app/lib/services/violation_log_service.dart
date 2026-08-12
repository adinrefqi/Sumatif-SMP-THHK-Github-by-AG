import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Persists exam integrity violations and heartbeats to local files
/// inside the app documents directory. This is the native side's source
/// of truth for audit logging (web side keeps its own localStorage copy).
class ViolationLogService {
  static final ViolationLogService _instance = ViolationLogService._internal();
  factory ViolationLogService() => _instance;
  ViolationLogService._internal();

  static const int _maxLogEntries = 500;

  Future<File> _getViolationFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/violation_log.json');
  }

  Future<File> _getHeartbeatFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/heartbeat.log');
  }

  Future<List<dynamic>> getViolations() async {
    try {
      final file = await _getViolationFile();
      if (!await file.exists()) return [];
      final raw = await file.readAsString();
      final parsed = jsonDecode(raw);
      return parsed is List ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  /// Appends a violation entry to violation_log.json.
  /// [entry] should contain at least 'type' and 'at'.
  Future<void> appendViolation(Map<String, dynamic> entry) async {
    try {
      final file = await _getViolationFile();
      final log = await getViolations();
      log.add({
        ...entry,
        'at': entry['at'] ?? DateTime.now().millisecondsSinceEpoch,
      });
      final trimmed = log.length > _maxLogEntries
          ? log.sublist(log.length - _maxLogEntries)
          : log;
      await file.writeAsString(jsonEncode(trimmed));
    } catch (e) {
      print("Failed to append violation: $e");
    }
  }

  /// Appends a heartbeat line (JSON) to heartbeat.log for audit.
  Future<void> appendHeartbeat(Map<String, dynamic> payload) async {
    try {
      final file = await _getHeartbeatFile();
      final line = jsonEncode({
        ...payload,
        'ts': payload['ts'] ?? DateTime.now().millisecondsSinceEpoch,
      });
      await file.writeAsString('$line\n', mode: FileMode.append);
    } catch (e) {
      print("Failed to append heartbeat: $e");
    }
  }
}
