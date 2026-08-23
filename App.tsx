import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

  useEffect(() => {
    // База открывается раньше i18n: язык интерфейса хранится в её настройках.
    void (async () => {
      await getDatabase();
      await initI18n();
      setReady(true);
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.light.bg,
        }}
      >
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
