# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Javascript interface methods for WebView bridge
-keepclassmembers class id.sch.smpthhk.exambrowser.WebBridge {
    public *;
}

# Keep all native app classes
-keep class id.sch.smpthhk.exambrowser.** { *; }