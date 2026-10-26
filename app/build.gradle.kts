plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.yinling.hotline"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.yinling.hotline"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    val releaseStore = providers.environmentVariable("ELDER_RELEASE_STORE_FILE").orNull
    val releaseStorePassword = providers.environmentVariable("ELDER_RELEASE_STORE_PASSWORD").orNull
    val releaseAlias = providers.environmentVariable("ELDER_RELEASE_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.environmentVariable("ELDER_RELEASE_KEY_PASSWORD").orNull
    if (listOf(releaseStore, releaseStorePassword, releaseAlias, releaseKeyPassword).all { !it.isNullOrBlank() }) {
        signingConfigs.create("production") {
            storeFile = file(releaseStore!!)
            storePassword = releaseStorePassword
            keyAlias = releaseAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        // The phone that goes to an elder's home must not carry a debug build: `debuggable=true`
        // lets anything with USB access read `files/sessions/*.json` through `adb run-as`, and those
        // files hold months of page text, typed drafts and delivery codes.
        //
        // Minification stays off until the app has been exercised once in this configuration; R8
        // breakage in a prototype is a worse risk than a larger APK.
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.findByName("production")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core"))
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
