import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palette, type Colors, type ThemeMode } from './tokens';
import { getSetting, setSetting } from '../db/repositories';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  colors: Colors;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SETTING_KEY = 'theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    getSetting(SETTING_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const mode: ThemeMode =
      preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return {
      mode,
      colors: palette[mode],
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        void setSetting(SETTING_KEY, next);
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme используется вне ThemeProvider');
  return context;
}

/** Короткий доступ к палитре — самый частый случай в компонентах. */
export function useColors(): Colors {
  return useTheme().colors;
}
