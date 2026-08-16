import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recordError } from '@/utils/analytics';
import { Colors, Spacing, FontSize } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  isDark?: boolean;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Wraps the app to catch React render errors and forward them to
 * Firebase Crashlytics. Shows a fallback UI with a Restart button.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    recordError(error, errorInfo?.componentStack ?? undefined);
  }

  handleRestart = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const isDark = this.props.isDark ?? true;
    const colors = isDark ? Colors.dark : Colors.light;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Ionicons name="warning-outline" size={56} color={colors.error} />
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We've been notified about this issue. Try restarting the app.
        </Text>
        <TouchableOpacity
          onPress={this.handleRestart}
          style={[styles.button, { backgroundColor: colors.primary }]}
          accessibilityLabel="Restart app"
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.buttonText}>Restart</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  body: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
