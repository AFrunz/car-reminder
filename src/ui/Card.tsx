import { View, type ViewProps } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { radius, sizes } from '../theme/tokens';

export interface CardProps extends ViewProps {
  padding?: number;
  radius?: number;
}

export function Card({
  padding = sizes.cardPadding,
  radius: cornerRadius = radius.xxl,
  style,
  ...rest
}: CardProps) {
  const colors = useColors();
  return (
    <View
      {...rest}
      style={[{ backgroundColor: colors.surface, borderRadius: cornerRadius, padding }, style]}
    />
  );
}
