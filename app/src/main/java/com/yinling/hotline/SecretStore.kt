package com.yinling.hotline

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.util.concurrent.atomic.AtomicLong

/**
 * The API key, encrypted at rest with a key that lives in the Android Keystore.
 *
 * Why it is worth storing at all: the person who sets this app up is the family, once. A key that
 * only lives in memory means the assistant silently stops working after every restart — and an
 * elderly user cannot retype a 35-character secret.
 *
 * Kept deliberately small: AES-GCM with one Keystore key, no rotation, no biometrics. If the
 * Keystore key is gone (lock screen changed, data restored onto another phone) the stored value is
 * dropped rather than guessed at.
 */
object SecretStore {

    private const val PREFS = "hotline"
    private const val KEYSTORE = "AndroidKeyStore"

    /** The model key, as before this file could hold more than one secret. */
    const val API_KEY = "api_key"

    /** The pairing token this phone uses to talk to the trusted-circle server. */
    const val DEVICE_TOKEN = "device_token"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val TAG_BITS = 128

    /** Bumped whenever the on-disk secret changes, so per-process caches can invalidate. */
    private val revisionCounter = AtomicLong(0)
    val revision: Long get() = revisionCounter.get()

    @Synchronized
    fun save(context: Context, plain: String, name: String = API_KEY): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ciphertextKey = "${name}_enc"
        val ivKey = "${name}_iv"
        val previousCiphertext = prefs.getString(ciphertextKey, null)
        val previousIv = prefs.getString(ivKey, null)
        return runCatching {
            val editor = prefs.edit()
            if (plain.isBlank()) {
                editor.remove(ciphertextKey).remove(ivKey)
            } else {
                val cipher = Cipher.getInstance(TRANSFORM)
                cipher.init(Cipher.ENCRYPT_MODE, secretKey(name))
                val bytes = cipher.doFinal(plain.toByteArray())
                editor.putString(ciphertextKey, Base64.encodeToString(bytes, Base64.NO_WRAP))
                    .putString(ivKey, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            }
            check(editor.commit()) { "credential_persistence_failed" }
            revisionCounter.incrementAndGet()
            true
        }.onFailure {
            if (!prefs.edit().putString(ciphertextKey, previousCiphertext).putString(ivKey, previousIv).commit()) {
                LoopLog.event("[key] 旧凭证恢复未能确认落盘")
            }
            revisionCounter.incrementAndGet()
            LoopLog.event("[key] 凭证保存失败：${it.javaClass.simpleName}")
        }.getOrDefault(false)
    }

    fun load(context: Context, name: String = API_KEY): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val data = prefs.getString("${name}_enc", null) ?: return ""
        val iv = prefs.getString("${name}_iv", null)
        if (iv == null) {
            prefs.edit().remove("${name}_enc").apply()
            revisionCounter.incrementAndGet()
            return ""
        }
        return runCatching {
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey(name),
                GCMParameterSpec(TAG_BITS, Base64.decode(iv, Base64.NO_WRAP)),
            )
            String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)))
        }.getOrElse {
            prefs.edit().remove("${name}_enc").remove("${name}_iv").apply()
            revisionCounter.incrementAndGet()
            LoopLog.event("[key] 解密失败，已清除（需要重新填写）：${it.message}")
            ""
        }
    }

    private fun secretKey(name: String): SecretKey {
        val alias = "hotline_$name"
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (store.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).apply {
            init(
                KeyGenParameterSpec.Builder(
                    alias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
        }.generateKey()
    }
}
