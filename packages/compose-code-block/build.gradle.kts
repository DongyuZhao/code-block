plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.compose)
}

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

android {
    namespace = "io.github.dongyuzhao.composecodeblock"
    compileSdk = 37

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    api(libs.kotlinx.coroutines.core)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.text)
    implementation(libs.androidx.compose.ui.unit)

    testImplementation(libs.junit)
    testImplementation(libs.json)
}
