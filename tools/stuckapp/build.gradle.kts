plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * 任务 #23 的专用测试替身：一个「永远转圈、内容永远不出现」的 App。
 *
 * 存在的理由见 tasks/preflight.md 第九节第 1 条：拿真实第三方 App 冷启动测不出来，代理第一次
 * 读到页面时它已经加载完了，「瞬态空树 / 卡死」这一条就没被测到。这里用一个前提可控的替身，
 * 让「先等待重试、最终有界停止」这件事可以被真正观察到。
 *
 * 它不是产品的一部分，只装在做真机评测的机器上。
 */
android {
    namespace = "com.yinling.stuckapp"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.yinling.stuckapp"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
