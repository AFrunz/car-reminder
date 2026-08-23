import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, sizes } from '../theme/tokens';

const OFF_X = sizes.toggleGap;
const ON_X = sizes.toggleWidth - sizes.toggleKnob - sizes.toggleGap;
const DURATION = 160;

export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ value, onChange, disabled = false }: ToggleProps) {
  const colors = useColors();
  const offset = useRef(new Animated.Value(value ? ON_X : OFF_X)).current;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: value ? ON_X : OFF_X,
      duration: DURATION,
      useNativeDriver: true,
    }).start();
  }, [offset, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? colors.accent : colors.muted, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          { backgroundColor: colors.onAccent, transform: [{ translateX: offset }] },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    height: sizes.toggleHeight,
    justifyContent: 'center',
    width: sizes.toggleWidth,
  },
  knob: {
    borderRadius: radius.pill,
    height: sizes.toggleKnob,
    width: sizes.toggleKnob,
  },
});
