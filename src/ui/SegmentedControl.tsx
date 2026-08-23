import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { fonts, fontSize, radius, sizes } from '../theme/tokens';
import { AppText } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fontSize: size = fontSize.segment,
  style,
}: SegmentedControlProps<T>) {
  const colors = useColors();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && { backgroundColor: colors.surface }]}
          >
            <AppText
              numberOfLines={1}
              tone={active ? 'primary' : 'secondary'}
              style={[
                { fontSize: size },
                { fontFamily: active ? fonts.uiSemibold : fonts.uiMedium },
              ]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: sizes.segmentPadding,
    padding: sizes.segmentPadding,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.segment,
    flex: 1,
    height: sizes.segmentHeight,
    justifyContent: 'center',
  },
});
