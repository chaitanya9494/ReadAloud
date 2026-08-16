# Loudify TTS and Release Strategy

## Product promise

Loudify remains a private, offline reader:

- No ads.
- No monthly subscription.
- Reading and speech work without an internet connection.
- User text and documents stay on the device.

The free, supported voice engine is Android Device Voices (the installed
Google, Samsung, or device-manufacturer TTS engine). Voice quality varies by
device and downloaded system voice data, but it has no per-user service cost
and is the only engine that meets the current product promise.

## Current release decision

Edge TTS is hidden from the UI and all persisted Edge/Piper/Sherpa selections
fall back to Device Voices. The Edge implementation remains in the codebase
only for future evaluation; it must not be presented, marketed, or relied on
in this release. This avoids startup network work, online-preview failures,
and a conflict with the offline/privacy policy.

Before release, prioritise stability over new TTS work:

1. Resolve every high-volume Crashlytics crash and ANR.
2. Test cold start, background/lock-screen playback, voice preview, document
   import, and voice selection on physical Android devices.
3. Test with airplane mode enabled. The app must start, open a saved document,
   choose a device voice, preview it, and read it aloud.
4. Release through a staged rollout and monitor Crashlytics/Android Vitals
   before increasing the percentage.

### Crashlytics fixes in this branch

- `expo.modules.speech.LanguageUtils` null-pointer crashes are avoided by
  reading Android voice metadata through `TtsVoiceInfoModule`, rather than
  Expo's unsafe `getAvailableVoicesAsync()` conversion on OEM TTS engines.
- The `AsyncStorageModule` and React Native out-of-memory cluster is mitigated
  by storing a compact document index instead of serialising the entire
  library for routine progress updates, and by rejecting new documents above
  1,000,000 characters / imports above 2 MB.
- The ExoPlayer out-of-memory cluster is removed from this release path:
  Piper and Expo AV are retired, so Device Voice playback does not initialise
  ExoPlayer.
- `DeadSystemException` raised inside Android's text-input framework is an OS
  process failure rather than an app exception. It cannot be fixed in app code;
  monitor it after release and do not group it with the memory regressions.

No server-side TTS service is part of this release. A hosted service would add
recurring operating costs, network dependency, privacy obligations, and a
requirement for usage limits; it does not fit the product promise.

## Future one-time premium offer

The viable premium direction is an optional **offline natural-voice pack**:

- Purchase once through Google Play.
- Download the selected model once, then synthesize entirely on-device.
- Keep the model outside the base APK so the normal install remains small.
- Offer a small curated set of voices, not a 322-language catalog.
- Existing users retain all functionality they already have; never remove
  their existing Device Voice reader capabilities.

The leading research candidate is **Kokoro-82M via a new Kotlin
Sherpa-ONNX module**, beginning with curated English voices. Kokoro's weights
are Apache-2.0 licensed, and Sherpa-ONNX provides Android/Kotlin offline TTS
support. This is new work, not a restoration of the removed legacy Sherpa
implementation.

References:

- [Kokoro-82M model card](https://huggingface.co/hexgrad/Kokoro-82M)
- [Sherpa-ONNX Android/Kotlin support](https://github.com/k2-fsa/sherpa-onnx)
- [Offline Android reference implementation](https://github.com/siva-sub/NekoSpeak)

## Guardrails for a future offline voice pack

1. Review the exact model, runtime, phonemizer, training data, and voice asset
   licences before distributing or charging for a pack.
2. Use an isolated Android native module and a small TypeScript bridge; do not
   make app startup wait for model loading or downloading.
3. Stream/synthesize sentence-by-sentence, support stop/pause/resume, and
   always fall back to Android Device Voices when a model is unavailable.
4. Benchmark on low- and mid-range physical devices for first-audio latency,
   memory use, battery drain, APK/download size, and long-document playback.
5. Require a successful offline test after installation before calling the
   pack production-ready.

Piper may be useful as a lightweight future fallback but is not the premium
quality target. Pocket TTS and voice-cloning models need extra consent,
impersonation, and model-licence review, so they are research only.

## Monetisation later

Do not activate the existing Pro screen or billing placeholders yet: Play
Billing is not currently integrated. When the offline voice pack is ready,
sell it as a one-time Google Play product. Do not sell a lifetime online voice
promise, and do not convert current core reader features into a paid-only
experience for existing users.
