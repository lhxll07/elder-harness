pluginManagement {
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        google()
        mavenCentral()
    }
}

rootProject.name = "yinling-hotline"
include(":core", ":app", ":harness")

// 任务 #23 的测试替身（tools/ 下，不是产品的一部分）。它只在真机评测时装到测试机上，
// 用一个前提可控的「永远加载不完」页面替代靠不住的第三方 App 冷启动。
include(":tools:stuckapp")
