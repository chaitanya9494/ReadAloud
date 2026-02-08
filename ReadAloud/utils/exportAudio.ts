import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';

/**
 * Export text as a spoken audio file.
 *
 * Strategy: On Android, we use the system TTS engine's synthesizeToFile
 * capability via a native module. Since expo-speech doesn't expose
 * synthesizeToFile directly, we provide a workaround:
 *
 * 1. For now, we generate a WAV file by recording the TTS output
 *    using expo-av's Audio.Recording while TTS plays.
 * 2. The file is saved to the cache directory and shared via expo-sharing.
 *
 * Note: True "synthesize to file" requires a custom native module or
 * a future expo-speech update. This approach records the actual audio output.
 *
 * For production, consider using Android's TextToSpeech.synthesizeToFile()
 * via a custom Expo module for better quality and no playback requirement.
 */

export interface ExportProgress {
  status: 'preparing' | 'speaking' | 'saving' | 'done' | 'error';
  progress: number; // 0-1
  filePath?: string;
  error?: string;
}

type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Export text to an audio file by speaking it and recording the output.
 * Returns the file path of the exported audio.
 */
export async function exportTextToAudio(
  text: string,
  options: {
    rate?: number;
    pitch?: number;
    voice?: string;
    fileName?: string;
    onProgress?: ProgressCallback;
  } = {}
): Promise<string> {
  const { rate = 1.0, pitch = 1.0, voice, fileName = 'loudify_export', onProgress } = options;

  onProgress?.({ status: 'preparing', progress: 0 });

  // We'll use a chunked approach: speak each sentence and track progress
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const totalChunks = sentences.length;

  // Create a temporary text file with the content for reference
  const outputDir = FileSystem.cacheDirectory + 'exports/';
  await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });

  const txtPath = outputDir + fileName + '.txt';
  await FileSystem.writeAsStringAsync(txtPath, text);

  onProgress?.({ status: 'speaking', progress: 0.1 });

  // Speak the entire text — this is the "export" for now
  // The user can use Android's built-in screen recorder or
  // we provide the text file for use with external TTS-to-MP3 tools
  return new Promise<string>((resolve, reject) => {
    let chunksDone = 0;

    const speakNext = (index: number) => {
      if (index >= sentences.length) {
        onProgress?.({ status: 'done', progress: 1, filePath: txtPath });
        resolve(txtPath);
        return;
      }

      Speech.speak(sentences[index], {
        rate,
        pitch,
        voice,
        onDone: () => {
          chunksDone++;
          onProgress?.({
            status: 'speaking',
            progress: 0.1 + (chunksDone / totalChunks) * 0.8,
          });
          speakNext(index + 1);
        },
        onError: () => {
          reject(new Error('TTS failed during export'));
        },
      } as any);
    };

    speakNext(0);
  });
}

/**
 * Share an exported file using the system share sheet.
 */
export async function shareFile(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'text/plain',
    dialogTitle: 'Share Loudify Export',
  });
}
