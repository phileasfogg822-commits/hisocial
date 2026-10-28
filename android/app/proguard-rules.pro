# Phase 27: ProGuard rules for the HiSocial APK shell.
# The shell has no code worth shrinking; keep the file
# so the release build type resolves.
-keep class com.hisocial.app.** { *; }
