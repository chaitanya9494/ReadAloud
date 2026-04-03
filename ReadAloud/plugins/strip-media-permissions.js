const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config plugin that removes READ_MEDIA_IMAGES, READ_MEDIA_VIDEO,
 * READ_EXTERNAL_STORAGE, and WRITE_EXTERNAL_STORAGE from the
 * Android manifest. These get auto-added by expo-image-picker
 * but are not needed when using the system photo picker.
 */
const PERMISSIONS_TO_REMOVE = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
];

function stripMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (perm) => {
          const name = perm.$?.['android:name'];
          return !PERMISSIONS_TO_REMOVE.includes(name);
        }
      );
    }
    return config;
  });
}

module.exports = stripMediaPermissions;
