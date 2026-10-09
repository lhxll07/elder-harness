plugins {
    id("org.jetbrains.kotlin.jvm")
    application
}

kotlin {
    jvmToolchain(17)
}

sourceSets {
    main {
        kotlin {
            srcDirs("src/main/kotlin", "../app/src/main/java")
            include("Harness.kt")
            include("com/yinling/hotline/CloudPlanner.kt")
        }
    }
}

dependencies {
    implementation(project(":core"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.json:json:20240303")
}

application {
    mainClass.set("HarnessKt")
}
