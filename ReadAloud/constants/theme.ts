export const Colors = {
  dark: {
    background: '#0f0f1a',
    surface: '#1a1a2e',
    surfaceLight: '#252547',
    primary: '#e94560',
    primaryLight: '#ff6b81',
    text: '#f0f0f5',
    textSecondary: '#8e8ea0',
    border: '#2e2e4a',
    success: '#4ecca3',
    warning: '#f0a500',
    error: '#ff6b6b',
  },
  light: {
    background: '#ffffff',
    surface: '#f5f5f7',
    surfaceLight: '#eaeaef',
    primary: '#d63050',
    primaryLight: '#e8546e',
    text: '#1c1c1e',
    textSecondary: '#636366',
    border: '#c7c7cc',
    success: '#2d8a6e',
    warning: '#e6960a',
    error: '#d63050',
  },
} as const;

export type ThemeColors = {
  [K in keyof typeof Colors.dark]: string;
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  title: 34,
} as const;
