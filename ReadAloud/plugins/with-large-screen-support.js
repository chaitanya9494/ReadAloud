const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withFinalizedMod,
} = require('expo/config-plugins');

/**
 * Keeps the native manifest aligned with the app configuration: Android may
 * resize Loudify on tablets, Chromebooks, and foldables, and the activity is
 * not locked to portrait. This is intentionally a config plugin so a future
 * Expo prebuild cannot restore the restriction.
 */
function withLargeScreenSupport(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application element was not found');

    application.$ = application.$ || {};
    application.$['android:resizeableActivity'] = 'true';

    const mainActivity = application.activity?.find(
      (activity) => activity.$?.['android:name'] === '.MainActivity'
    );
    if (mainActivity?.$) delete mainActivity.$['android:screenOrientation'];

    // expo-camera's bundled ML Kit delegate still requests portrait. It is a
    // merged dependency activity, so remove that inherited restriction too.
    // This keeps camera scanning available while allowing Android to choose
    // the appropriate orientation on tablets, foldables, and Chromebooks.
    const barcodeScannerActivity = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
    const scannerActivity = application.activity?.find(
      (activity) => activity.$?.['android:name'] === barcodeScannerActivity
    );
    if (scannerActivity) {
      scannerActivity.$ = scannerActivity.$ || {};
      scannerActivity.$['tools:remove'] = 'android:screenOrientation';
    } else {
      application.activity = application.activity || [];
      application.activity.push({
        $: {
          'android:name': barcodeScannerActivity,
          'tools:remove': 'android:screenOrientation',
        },
      });
    }

    return config;
  });

  // This finalized mod runs after Expo's built-in splash plugin. It removes
  // obsolete system-bar theme attributes, swaps in the adaptive icon, and
  // removes the generated raster splash canvases from the release package.
  return withFinalizedMod(config, ['android', async (config) => {
    const resDirectory = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    const stylesPath = path.join(resDirectory, 'values', 'styles.xml');
    let styles = fs.readFileSync(stylesPath, 'utf8');
    styles = styles
      .replace(/^\s*<item name="android:statusBarColor">.*?<\/item>\r?\n/gm, '')
      .replace(/^\s*<item name="android:enforceNavigationBarContrast".*?<\/item>\r?\n/gm, '')
      .replace('@drawable/splashscreen_logo', '@mipmap/ic_launcher');
    fs.writeFileSync(stylesPath, styles);

    // Expo's legacy fallback layer list also embeds the generated splash logo.
    // Keep its background-only fallback so every Android resource remains valid.
    fs.writeFileSync(
      path.join(resDirectory, 'drawable', 'ic_launcher_background.xml'),
      '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n' +
        '  <item android:drawable="@color/splashscreen_background"/>\n' +
      '</layer-list>\n'
    );

    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      fs.rmSync(path.join(resDirectory, `drawable-${density}`, 'splashscreen_logo.png'), {
        force: true,
      });
    }
    return config;
  }]);
}

module.exports = withLargeScreenSupport;
