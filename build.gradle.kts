plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.compose) apply false
    // Roborazzi drives Android pixel snapshots on the JVM (keeps AGP 9); the
    // official Compose screenshot plugin does not support AGP 9 yet.
    alias(libs.plugins.roborazzi) apply false
}

allprojects {
    if (!tasks.names.contains("prepareKotlinBuildScriptModel")) {
        tasks.register("prepareKotlinBuildScriptModel") {
            group = "help"
            description = "Compatibility task for IDE Kotlin build script model sync."
        }
    }

    plugins.withType<org.jetbrains.kotlin.gradle.plugin.KotlinBasePluginWrapper> {
        extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension> {
            jvmToolchain(libs.versions.jdk.get().toInt())
        }
    }
}
