import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, layout, sizes } from '../theme/tokens';
import { AppText } from './Text';

export interface AppBarProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function AppBar({ title, onBack, right }: AppBarProps) {
  const colors = useColors();
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <ArrowLeft size={sizes.iconBack} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      <AppText numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

export interface CarAppBarProps {
  carName: string;
  onPressCar: () => void;
  right?: ReactNode;
}

export function CarAppBar({ carName, onPressCar, right }: CarAppBarProps) {
  const colors = useColors();
  return (
    <View style={[styles.bar, styles.carBar]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPressCar}
        style={({ pressed }) => [styles.car, { opacity: pressed ? 0.7 : 1 }]}
      >
        <AppText variant="title" numberOfLines={1}>
          {carName}
        </AppText>
        <ChevronDown size={sizes.iconMd} color={colors.textSecondary} />
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: layout.appBar.gap,
    height: sizes.appBarHeight,
    paddingHorizontal: layout.appBar.paddingHorizontal,
  },
  carBar: {
    justifyContent: 'space-between',
    paddingHorizontal: layout.carAppBar.paddingHorizontal,
  },
  backButton: {
    alignItems: 'center',
    height: sizes.iconButton,
    justifyContent: 'center',
    width: sizes.iconButton,
  },
  title: {
    flex: 1,
    fontFamily: fonts.uiSemibold,
    fontSize: fontSize.appBarTitle,
  },
  car: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: layout.carAppBar.gap,
  },
});
