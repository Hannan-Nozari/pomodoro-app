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

# Readable stack traces from release crashes; the source file name itself is
# stripped, so this leaks nothing.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor resolves plugins and their @PluginMethod entry points by reflection
# at runtime, so R8 cannot see those uses and would strip them.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep class capacitor.android.plugins.** { *; }

# Bridge methods exposed to the WebView's JavaScript.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
