import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { getDatabase } from './src/db/database';
import { initI18n } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { GarageProvider } from './src/state/GarageContext';
import RootNavigator from './src/navigation/RootNavigator';
import { palette } from './src/theme/tokens';

function AppShell() {
  const { colors, mode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <GarageProvider>
        <RootNavigator />
      </GarageProvider>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // База открывается раньше i18n: язык интерфейса хранится в её настройках.
    (async () => {
      try {
        await getDatabase();
        await initI18n();
        if (!cancelled) setReady(true);
      } catch (error) {
        // Без этого любая ошибка запуска — например неудачная миграция — оставляла
        // приложение в вечной загрузке без единого намёка на причину.
        console.error('Не удалось запустить приложение', error);
        if (!cancelled) setStartupError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (startupError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось запустить приложение</Text>
        <Text style={styles.errorBody}>{startupError}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => {
            setStartupError(null);
            setAttempt((value) => value + 1);
          }}
        >
          <Text style={styles.retryLabel}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (!fontsLoaded || !ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.light.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Стили экрана ошибки намеренно не зависят ни от темы, ни от шрифтов: он показывается
// именно тогда, когда что-то из этого могло не подняться.
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: palette.light.bg,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.light.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retry: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.light.accent,
  },
  retryLabel: { fontSize: 16, fontWeight: '600', color: palette.light.onAccent },
});
