# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}
-dontwarn io.branch.**


# react native keychain https://github.com/oblador/react-native-keychain#proguard-rules
-keep class com.facebook.crypto.** {
   *;
}

# react-native-svg https://github.com/react-native-svg/react-native-svg#problems-with-proguard
-keep public class com.horcrux.svg.** {*;}