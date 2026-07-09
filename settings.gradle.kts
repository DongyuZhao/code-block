pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "code-block"

include(":packages:compose-code-block")
project(":packages:compose-code-block").projectDir = file("packages/compose-code-block")

include(":samples:compose-code-block-sample")
project(":samples:compose-code-block-sample").projectDir = file("samples/compose-code-block-sample/app")
