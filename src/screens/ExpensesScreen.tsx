import React from 'react';
import { View } from 'react-native';
import { AppText } from '../ui';
import { useColors } from '../theme/ThemeProvider';

export default function () {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <AppText variant="heading"></AppText>
    </View>
  );
}
