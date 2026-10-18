import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider';
import { layout, sizes, spacing } from '../theme/tokens';
import type { Car } from '../domain/types';
import { BottomSheet } from './BottomSheet';
import { AppText } from './Text';

export interface CarPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  cars: Car[];
  activeCarId: string | null;
  onSelect: (carId: string) => void;
  onAddCar: () => void;
}

const carTitle = (car: Car): string => `${car.make} ${car.model}`;

/**
 * Выбор машины из шапки. Открывается и при одной машине: иначе тап по названию с
 * шевроном ничего не делал, а добавить вторую можно было только через настройки.
 */
export function CarPickerSheet({
  visible,
  onClose,
  cars,
  activeCarId,
  onSelect,
  onAddCar,
}: CarPickerSheetProps) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('common.selectCar')}>
      <View style={styles.list}>
        {cars.map((car) => (
          <Pressable
            key={car.id}
            accessibilityRole="button"
            onPress={() => {
              onSelect(car.id);
              onClose();
            }}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>
              {carTitle(car)}
            </AppText>
            {car.id === activeCarId ? <Check size={sizes.iconMd} color={colors.accent} /> : null}
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onClose();
            onAddCar();
          }}
          style={({ pressed }) => [
            styles.row,
            styles.addRow,
            { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <AppText variant="bodyMedium" tone="accent" style={styles.name}>
            {t('settings.addCar')}
          </AppText>
          <Plus size={sizes.iconMd} color={colors.accent} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.md,
    paddingHorizontal: layout.sheet.paddingHorizontal,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  addRow: {
    borderTopWidth: sizes.border,
  },
  name: {
    flexShrink: 1,
  },
});
