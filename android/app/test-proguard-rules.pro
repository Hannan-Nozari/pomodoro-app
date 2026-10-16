# AndroidX test dependencies include compiler-only Error Prone annotations.
# Their enum type belongs to javac and is absent on Android. This applies only
# to the instrumentation APK, not to the application's release rules.
-dontwarn javax.lang.model.element.Modifier
