import 'package:audioplayers/audioplayers.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:volume_controller/volume_controller.dart';

class SecurityService {
  static final SecurityService _instance = SecurityService._internal();
  factory SecurityService() => _instance;
  SecurityService._internal();

  final AudioPlayer _audioPlayer = AudioPlayer();
  final Battery _battery = Battery();
  bool _isAlarmPlaying = false;

  Future<void> initAudio() async {
    await _audioPlayer.setReleaseMode(ReleaseMode.loop);
  }

  Future<void> playSirenAlarm() async {
    if (_isAlarmPlaying) return;
    _isAlarmPlaying = true;
    try {
      // Force System Volume to 90%
      VolumeController.instance.showSystemUI = false;
      await VolumeController.instance.setVolume(0.9);
      // Set Player volume to max
      await _audioPlayer.setVolume(1.0);
      // Play system alert sound or online tone URL
      await _audioPlayer.play(
        UrlSource('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'),
      );
    } catch (e) {
      print("Error playing siren alarm: $e");
      // Reset flag so alarm can be retried on next lifecycle event
      _isAlarmPlaying = false;
    }
  }

  Future<void> stopSirenAlarm() async {
    if (!_isAlarmPlaying) return;
    _isAlarmPlaying = false;
    try {
      await _audioPlayer.stop();
    } catch (e) {
      print("Error stopping siren alarm: $e");
    }
  }

  Future<int> getBatteryLevel() async {
    try {
      return await _battery.batteryLevel;
    } catch (e) {
      return 85;
    }
  }
}
