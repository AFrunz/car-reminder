import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Gauge, Wrench, Wallet, Settings as SettingsIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, sizes } from '../theme/tokens';
import type { RootStackParamList, TabParamList } from './types';

import ServiceScreen from '../screens/ServiceScreen';
import PartsScreen from '../screens/PartsScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PartDetailScreen from '../screens/PartDetailScreen';
import PartsCatalogScreen from '../screens/PartsCatalogScreen';
import PartFormScreen from '../screens/PartFormScreen';
import RecordFormScreen from '../screens/RecordFormScreen';
import CarFormScreen from '../screens/CarFormScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: sizes.tabBarHeight,
          paddingTop: 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.uiMedium, fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Service"
        component={ServiceScreen}
        options={{
          title: t('tabs.service'),
          tabBarIcon: ({ color }) => <Wrench size={sizes.iconNav} color={color} />,
        }}
      />
      <Tab.Screen
        name="Parts"
        component={PartsScreen}
        options={{
          title: t('tabs.parts'),
          tabBarIcon: ({ color }) => <Gauge size={sizes.iconNav} color={color} />,
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          title: t('tabs.expenses'),
          tabBarIcon: ({ color }) => <Wallet size={sizes.iconNav} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <SettingsIcon size={sizes.iconNav} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { colors, mode } = useTheme();

  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="PartDetail" component={PartDetailScreen} />
        <Stack.Screen name="PartsCatalog" component={PartsCatalogScreen} />
        <Stack.Screen name="PartForm" component={PartFormScreen} />
        <Stack.Screen name="RecordForm" component={RecordFormScreen} />
        <Stack.Screen name="CarForm" component={CarFormScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
