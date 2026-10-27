import { useColorScheme } from 'react-native';

export const lightTheme = {
  background: '#f5f1e6',
  surface: '#ffffff',
  card: '#fbf8f0',
  primary: '#1b3a2a',
  primaryLight: '#2e5c43',
  accent: '#c98a3d',
  text: '#22301f',
  textMuted: '#6b7a66',
  border: '#ddd5c2',
  danger: '#b3372f',
  warning: '#c98a3d',
  success: '#2e7d4f',
  chipBg: '#e7e0cd',
};

export const darkTheme = {
  background: '#141d17',
  surface: '#1b261f',
  card: '#22301f',
  primary: '#7fb894',
  primaryLight: '#a5d0b6',
  accent: '#d9a45b',
  text: '#eef3ea',
  textMuted: '#9fb3a1',
  border: '#33443a',
  danger: '#e07a70',
  warning: '#d9a45b',
  success: '#6fbf8a',
  chipBg: '#2c3b31',
};

export type Theme = typeof lightTheme;

export function useAppTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
