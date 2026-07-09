import org.gradle.api.publish.maven.MavenPublication

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.roborazzi)
    `maven-publish`
}

group = "io.github.dongyuzhao"
version = "0.1.0"

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

        externalNativeBuild {
            cmake {
                arguments += listOf("-DCB_BUILD_JNI=ON")
                abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
            }
        }
    }

    buildFeatures {
        compose = true
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    externalNativeBuild {
        cmake {
            path = file("../shared/code-block-core/CMakeLists.txt")
        }
    }
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                artifactId = "compose-code-block"

                pom {
                    name = "Compose Code Block"
                    description = "Jetpack Compose tree-sitter code block renderer"
                    url = "https://github.com/DongyuZhao/code-block"
                }
            }
        }
        repositories {
            maven {
                name = "consumerTest"
                url = layout.buildDirectory.dir("consumer-test-repository").get().asFile.toURI()
            }
        }
    }
}

dependencies {
    api(libs.kotlinx.coroutines.core)
    api(platform(libs.androidx.compose.bom))
    api(libs.androidx.compose.runtime)
    api(libs.androidx.compose.ui)
    api(libs.androidx.compose.ui.graphics)

    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.text)
    implementation(libs.androidx.compose.ui.unit)

    testImplementation(libs.junit)
    testImplementation(libs.json)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.robolectric)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit.rule)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
