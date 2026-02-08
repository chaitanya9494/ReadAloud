import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { captureImage, pickImage, extractTextFromImage } from '@/utils/ocrScanner';

interface Props {
  onTextExtracted: (text: string, source: string) => void;
}

export default function OcrScannerButton({ onTextExtracted }: Props) {
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'preview' | 'manual'>('choose');

  const handleCapture = async () => {
    try {
      const uri = await captureImage();
      if (uri) {
        setImageUri(uri);
        await processImage(uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message);
    }
  };

  const handlePick = async () => {
    try {
      const uri = await pickImage();
      if (uri) {
        setImageUri(uri);
        await processImage(uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const processImage = async (uri: string) => {
    setLoading(true);
    setMode('preview');
    try {
      // Try OCR — will throw OCR_NO_KEY if no API key configured
      const text = await extractTextFromImage(uri);
      setExtractedText(text);
    } catch (err: any) {
      if (err.message === 'OCR_NO_KEY') {
        // Fall back to manual text entry mode
        setMode('manual');
        setExtractedText('');
      } else {
        Alert.alert('OCR Error', err.message);
        setMode('manual');
        setExtractedText('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (extractedText.trim()) {
      onTextExtracted(extractedText.trim(), 'Camera Scan');
      handleClose();
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setImageUri(null);
    setExtractedText('');
    setMode('choose');
    setLoading(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        style={[styles.button, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
        accessibilityLabel="Scan text from camera or image"
        accessibilityRole="button"
      >
        <Ionicons name="camera-outline" size={22} color={colors.primary} />
        <Text style={[styles.buttonText, { color: colors.text }]}>Scan Text</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                <Ionicons name="scan-outline" size={20} /> Scan Text
              </Text>
              <TouchableOpacity onPress={handleClose} accessibilityLabel="Close" accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {mode === 'choose' && (
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  onPress={handleCapture}
                  style={[styles.choiceBtn, { backgroundColor: colors.primary }]}
                  accessibilityLabel="Take a photo"
                  accessibilityRole="button"
                >
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.choiceBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePick}
                  style={[styles.choiceBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border, borderWidth: 1 }]}
                  accessibilityLabel="Pick from gallery"
                  accessibilityRole="button"
                >
                  <Ionicons name="images" size={28} color={colors.primary} />
                  <Text style={[styles.choiceBtnText, { color: colors.text }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}

            {loading && (
              <View style={styles.loadingSection}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Extracting text...
                </Text>
              </View>
            )}

            {/* Image preview */}
            {imageUri && !loading && (
              <Image
                source={{ uri: imageUri }}
                style={styles.preview}
                resizeMode="contain"
              />
            )}

            {/* Manual text entry (when OCR not available) */}
            {mode === 'manual' && !loading && (
              <View style={styles.manualSection}>
                <Text style={[styles.manualHint, { color: colors.textSecondary }]}>
                  Tip: Use Google Lens on the photo to copy text, then paste it below.
                </Text>
                <TextInput
                  style={[styles.manualInput, {
                    backgroundColor: colors.surfaceLight,
                    color: colors.text,
                    borderColor: colors.border,
                  }]}
                  placeholder="Paste extracted text here..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  value={extractedText}
                  onChangeText={setExtractedText}
                  textAlignVertical="top"
                  accessibilityLabel="Paste scanned text"
                />
              </View>
            )}

            {/* Auto-extracted text preview */}
            {mode === 'preview' && extractedText && !loading && (
              <View style={styles.manualSection}>
                <Text style={[styles.manualHint, { color: colors.success }]}>
                  Text extracted. Edit if needed:
                </Text>
                <TextInput
                  style={[styles.manualInput, {
                    backgroundColor: colors.surfaceLight,
                    color: colors.text,
                    borderColor: colors.border,
                  }]}
                  multiline
                  value={extractedText}
                  onChangeText={setExtractedText}
                  textAlignVertical="top"
                  accessibilityLabel="Extracted text"
                />
              </View>
            )}

            {/* Confirm button */}
            {(mode === 'manual' || mode === 'preview') && !loading && (
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={!extractedText.trim()}
                style={[styles.confirmBtn, {
                  backgroundColor: extractedText.trim() ? colors.primary : colors.surfaceLight,
                }]}
                accessibilityLabel="Read scanned text"
                accessibilityRole="button"
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>Read This Text</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
  },
  buttonText: { fontSize: FontSize.sm, fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: '600' },
  choiceRow: { flexDirection: 'row', gap: Spacing.sm },
  choiceBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.lg, borderRadius: 16,
  },
  choiceBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  loadingSection: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm },
  preview: { width: '100%', height: 150, borderRadius: 12, marginBottom: Spacing.sm },
  manualSection: { gap: Spacing.sm },
  manualHint: { fontSize: FontSize.xs },
  manualInput: {
    borderWidth: 1, borderRadius: 10, padding: Spacing.sm,
    fontSize: FontSize.sm, minHeight: 100, maxHeight: 180,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.md, borderRadius: 12, marginTop: Spacing.md,
  },
  confirmBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
