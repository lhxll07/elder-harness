package com.yinling.hotline

import android.app.Application
import android.content.Intent
import android.provider.Settings
import com.yinling.core.SkillStore

class HotlineApp : Application() {
    lateinit var session: SessionController
        private set

    /** Speaks the assistant's lines aloud; see [Speaker] for why this is not optional. */
    val speaker: Speaker by lazy { Speaker(this) }

    /** Records one utterance for the server-side recogniser. */
    val recorder: VoiceRecorder by lazy { VoiceRecorder() }

    /** Reads/writes generated skills under files/skills/. */
    val skills: SkillStore by lazy { SkillStore(filesDir) }

    /** One shared judge for the daily peace check, used by the service and settings. */
    val peace: PeaceCheck by lazy { PeaceCheck(this) }

    override fun onCreate() {
        super.onCreate()
        LoopLog.attach(this)
        refreshSkills()
        session = SessionController(this)
        LoopLog.enabled = session.developerMode
    }

    /** Makes the current active files visible to the model's load_skill catalog. */
    fun refreshSkills() {
        SkillCatalog.generated = skills.activeSkills()
    }

    /** The system screen where a speech engine is installed or chosen. */
    fun openTextToSpeechSettings() {
        val direct = Intent("com.android.settings.TTS_SETTINGS")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { startActivity(direct) }.onFailure {
            startActivity(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
    }

    fun openDisplaySettings() {
        startActivity(Intent(Settings.ACTION_DISPLAY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun launchers() = packageManager.queryIntentActivities(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0,
    )

    fun launchableApps(): List<String> = launchers().map {
        it.loadLabel(packageManager).toString()
    }.distinct().sorted()

    fun openApp(name: String): Boolean {
        val matches = launchers().filter { it.loadLabel(packageManager).toString() == name }
        if (matches.size != 1) return false
        val intent = packageManager.getLaunchIntentForPackage(matches.single().activityInfo.packageName)
            ?: return false
        startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return true
    }
}
