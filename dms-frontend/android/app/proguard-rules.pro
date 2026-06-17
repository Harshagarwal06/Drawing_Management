# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Capacitor / Cordova WebView bridge (required when minifyEnabled = true) ──
# The native bridge resolves plugins and @PluginMethod handlers by reflection,
# so they must survive R8 shrinking/obfuscation.
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
-keep class com.getcapacitor.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin
-keep class org.apache.cordova.** { *; }

# JS-facing interfaces called from the WebView
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
-keepattributes *Annotation*
