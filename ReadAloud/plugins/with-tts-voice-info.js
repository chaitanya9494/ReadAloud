const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('expo/config-plugins');

const MODULE_SOURCE = `package com.loudify.app

import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

/** Reads Android's TTS voice list without Expo's unsafe OEM locale conversion. */
class TtsVoiceInfoModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), TextToSpeech.OnInitListener {
  private var textToSpeech: TextToSpeech? = null
  private var initialized = false
  private val pending = mutableListOf<Promise>()

  override fun getName() = "TtsVoiceInfo"

  @ReactMethod
  fun getVoices(promise: Promise) {
    val tts = textToSpeech
    if (tts == null) {
      pending.add(promise)
      textToSpeech = TextToSpeech(reactApplicationContext, this)
    } else if (!initialized) {
      pending.add(promise)
    } else {
      resolveVoices(promise)
    }
  }

  override fun onInit(status: Int) {
    initialized = status == TextToSpeech.SUCCESS
    val waiting = pending.toList()
    pending.clear()
    waiting.forEach { promise ->
      if (initialized) resolveVoices(promise)
      else promise.reject("TTS_INIT_FAILED", "Android text-to-speech could not be initialized")
    }
  }

  private fun resolveVoices(promise: Promise) {
    try {
      val result = Arguments.createArray()
      val voices: Set<Voice> = textToSpeech?.voices ?: emptySet()
      voices.forEach { voice ->
        if (voice.name.isNullOrBlank()) return@forEach
        val row = Arguments.createMap()
        row.putString("identifier", voice.name)
        row.putString("name", voice.name)
        row.putString("language", safeLanguageTag(voice.locale))
        row.putString("quality", if (voice.quality >= Voice.QUALITY_HIGH) "Enhanced" else "Standard")
        result.pushMap(row)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("TTS_VOICES_FAILED", "Android text-to-speech voices could not be read", error)
    }
  }

  private fun safeLanguageTag(locale: Locale?): String = try {
    if (locale == null) "und" else locale.toLanguageTag().takeIf { it.isNotBlank() && it != "und" }
      ?: locale.language.takeIf { it.isNotBlank() } ?: "und"
  } catch (_: Exception) { "und" }

  override fun invalidate() {
    pending.clear()
    textToSpeech?.shutdown()
    textToSpeech = null
    super.invalidate()
  }
}
`;

const PACKAGE_SOURCE = `package com.loudify.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TtsVoiceInfoPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(TtsVoiceInfoModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;

function withTtsVoiceInfo(config) {
  config = withDangerousMod(config, ['android', async (config) => {
    const packageDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'loudify', 'app');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'TtsVoiceInfoModule.kt'), MODULE_SOURCE);
    fs.writeFileSync(path.join(packageDir, 'TtsVoiceInfoPackage.kt'), PACKAGE_SOURCE);
    return config;
  }]);

  return withMainApplication(config, (config) => {
    const marker = 'PackageList(this).packages.apply {';
    let source = config.modResults.contents;
    if (!source.includes(marker)) throw new Error('Could not register TtsVoiceInfoPackage in MainApplication.kt');
    if (!source.includes('add(TtsVoiceInfoPackage())')) source = source.replace(marker, `${marker}\n              add(TtsVoiceInfoPackage())`);
    config.modResults.contents = source;
    return config;
  });
}

module.exports = withTtsVoiceInfo;
