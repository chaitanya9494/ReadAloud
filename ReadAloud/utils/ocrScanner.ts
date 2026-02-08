import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/**
 * OCR Scanner — capture or pick an image and extract text.
 *
 * Strategy: We use Google's free Cloud Vision OCR via a lightweight
 * fetch call. For a fully offline approach, you'd need a native
 * ML Kit module (expo doesn't bundle one yet).
 *
 * As a privacy-first fallback, we also support a "manual paste" flow
 * where the user takes a photo and the app prompts them to use
 * Google Lens or similar to copy the text.
 *
 * For production, consider:
 * - react-native-mlkit-ocr (on-device, no network)
 * - Google ML Kit via a custom Expo module
 */

export interface OcrResult {
  text: string;
  imageUri: string;
}

/**
 * Launch the camera to take a photo of text.
 * Returns the image URI for further processing.
 */
export async function captureImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission is required to scan text.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * Pick an image from the gallery.
 */
export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * Extract text from an image using Google Cloud Vision API.
 * Requires an API key. For a free tier, this handles ~1000 requests/month.
 *
 * If no API key is configured, falls back to a prompt for manual text entry.
 */
export async function extractTextFromImage(
  imageUri: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) {
    // No API key — use the free Google Lens approach
    throw new Error('OCR_NO_KEY');
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error('OCR request failed. Check your API key.');
  }

  const data = await response.json();
  const text = data.responses?.[0]?.fullTextAnnotation?.text;

  if (!text) {
    throw new Error('No text found in this image. Try a clearer photo.');
  }

  return text.trim();
}
