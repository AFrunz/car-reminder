import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  AppText,
  Banner,
  Field,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  type SegmentOption,
} from '../ui';
import { useColors } from '../theme/ThemeProvider';
import { fonts, sizes, spacing } from '../theme/tokens';
import { useGarage } from '../state/GarageContext';
import { createCar, deleteCar, updateCar, type NewCar } from '../db/repositories';
import { currentLanguage } from '../i18n';
import { formatNumber, parseNumberInput } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import type { FuelType, Transmission } from '../domain/types';

/**
 * Форма машины. Тип топлива и коробка нужны не сами по себе, а чтобы отфильтровать
 * стартовый каталог деталей (раздел 1 спецификации), поэтому под ними стоит поясняющий
 * баннер: пользователь должен понимать, на что влияет выбор.
 *
 * Пробег спрашиваем обязательно — от него считается вообще всё остальное.
 */

const FUEL_TYPES: readonly FuelType[] = ['petrol', 'diesel', 'hybrid', 'electric'];
const TRANSMISSIONS: readonly Transmission[] = ['manual', 'automatic'];

/** Подписи четырёх видов топлива не влезают в сегменты кеглем по умолчанию. */
const FUEL_SEGMENT_FONT_SIZE = 12;

/** Разумные границы года выпуска: раньше автомобилей почти не было, позже — ещё не выпущены. */
const MIN_YEAR = 1900;
const MAX_YEAR_AHEAD = 1;

const DEFAULT_INTERVAL_KM = 10_000;
const DEFAULT_INTERVAL_MONTHS = 12;

interface FormErrors {
  make?: string;
  model?: string;
  year?: string;
  mileage?: string;
}

export default function CarFormScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CarForm'>>();
  const { cars, refresh } = useGarage();
  const language = currentLanguage();

  const carId = route.params?.carId;
  const car = useMemo(() => cars.find((item) => item.id === carId) ?? null, [cars, carId]);

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuel, setFuel] = useState<FuelType>('petrol');
  const [transmission, setTransmission] = useState<Transmission>('manual');
  const [mileage, setMileage] = useState('');
  const [intervalKm, setIntervalKm] = useState(formatNumber(DEFAULT_INTERVAL_KM, language));
  const [intervalMonths, setIntervalMonths] = useState(String(DEFAULT_INTERVAL_MONTHS));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Заполняем форму ровно один раз на машину: гараж перечитывается после любой мутации,
  // и без этой отметки правки пользователя затирались бы при каждом обновлении.
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!car || filledFor.current === car.id) return;
    filledFor.current = car.id;
    setMake(car.make);
    setModel(car.model);
    setYear(String(car.year));
    setFuel(car.fuel);
    setTransmission(car.transmission);
    setMileage(formatNumber(car.mileage, language));
    setIntervalKm(formatNumber(car.serviceIntervalKm, language));
    setIntervalMonths(String(car.serviceIntervalMonths));
  }, [car, language]);

  const fuelOptions = useMemo<SegmentOption<FuelType>[]>(
    () => FUEL_TYPES.map((value) => ({ value, label: t(`fuel.${value}`) })),
    [t],
  );
  const transmissionOptions = useMemo<SegmentOption<Transmission>[]>(
    () => TRANSMISSIONS.map((value) => ({ value, label: t(`transmission.${value}`) })),
    [t],
  );

  const validate = (): NewCar | null => {
    const nextErrors: FormErrors = {};
    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const parsedYear = parseNumberInput(year);
    const parsedMileage = parseNumberInput(mileage);
    const maxYear = new Date().getFullYear() + MAX_YEAR_AHEAD;

    if (trimmedMake.length === 0) nextErrors.make = t('carForm.makeRequired');
    if (trimmedModel.length === 0) nextErrors.model = t('carForm.modelRequired');
    if (parsedYear === null || parsedYear < MIN_YEAR || parsedYear > maxYear) {
      nextErrors.year = t('carForm.yearInvalid');
    }
    if (parsedMileage === null || parsedMileage < 0) {
      nextErrors.mileage = t('carForm.mileageRequired');
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsedYear === null || parsedMileage === null) {
      return null;
    }

    return {
      make: trimmedMake,
      model: trimmedModel,
      year: parsedYear,
      fuel,
      transmission,
      mileage: parsedMileage,
      serviceIntervalKm: parseNumberInput(intervalKm) ?? 0,
      serviceIntervalMonths: parseNumberInput(intervalMonths) ?? 0,
    };
  };

  const submit = async (): Promise<void> => {
    const payload = validate();
    if (!payload || saving) return;
    setSaving(true);
    try {
      if (carId) await updateCar(carId, payload);
      else await createCar(payload);
      refresh();
      navigation.goBack();
    } catch {
      setSaving(false);
      Alert.alert(t('common.error'));
    }
  };

  const confirmDelete = (): void => {
    if (!car) return;
    Alert.alert(
      t('settings.deleteCarConfirm', { car: `${car.make} ${car.model}`.trim() }),
      t('settings.deleteCarWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteCar(car.id);
              refresh();
              navigation.goBack();
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <AppBar
        title={carId ? t('carForm.editTitle') : t('carForm.title')}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + sizes.appBarHeight}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: sizes.screenPadding + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <FieldBlock error={errors.make}>
              <Field label={t('carForm.make')} value={make} onChangeText={setMake} />
            </FieldBlock>
            <FieldBlock error={errors.model}>
              <Field label={t('carForm.model')} value={model} onChangeText={setModel} />
            </FieldBlock>
          </View>

          <FieldBlock error={errors.year}>
            <Field
              label={t('carForm.year')}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              mono
            />
          </FieldBlock>

          <View style={styles.group}>
            <SectionHeader title={t('carForm.fuel')} />
            <SegmentedControl
              options={fuelOptions}
              value={fuel}
              onChange={setFuel}
              fontSize={FUEL_SEGMENT_FONT_SIZE}
            />
          </View>

          <View style={styles.group}>
            <SectionHeader title={t('carForm.transmission')} />
            <SegmentedControl
              options={transmissionOptions}
              value={transmission}
              onChange={setTransmission}
            />
          </View>

          <FieldBlock error={errors.mileage}>
            <Field
              label={t('carForm.mileage')}
              value={mileage}
              onChangeText={setMileage}
              suffix={t('units.km')}
              keyboardType="number-pad"
              mono
            />
          </FieldBlock>

          <View style={styles.intervalGroup}>
            <SectionHeader title={t('carForm.serviceInterval')} />
            <View style={styles.row}>
              <Field
                style={styles.flex}
                label={t('partForm.byMileage')}
                value={intervalKm}
                onChangeText={setIntervalKm}
                suffix={t('units.km')}
                keyboardType="number-pad"
                mono
              />
              <Field
                style={styles.flex}
                label={t('partForm.byTime')}
                value={intervalMonths}
                onChangeText={setIntervalMonths}
                suffix={t('units.months')}
                keyboardType="number-pad"
                mono
              />
            </View>
            <AppText tone="tertiary" style={styles.hint}>
              {t('carForm.serviceIntervalHint')}
            </AppText>
          </View>

          <Banner tone="info" text={t('carForm.catalogHint')} />

          <AppText tone="tertiary" style={styles.hint}>
            {t('carForm.historyHint')}
          </AppText>

          <View style={styles.spacer} />

          <PrimaryButton
            fullWidth
            disabled={saving}
            title={carId ? t('common.save') : t('carForm.submit')}
            onPress={() => void submit()}
          />

          {carId ? (
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.7 : 1 }]}
            >
              <AppText tone="danger" style={styles.deleteLabel}>
                {t('settings.deleteCar')}
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface FieldBlockProps {
  children: React.ReactNode;
  error?: string;
}

/** Поле вместе с сообщением об ошибке: в ряду оба блока должны делить ширину поровну. */
function FieldBlock({ children, error }: FieldBlockProps) {
  return (
    <View style={styles.fieldBlock}>
      {children}
      {error ? (
        <AppText variant="label" tone="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: sizes.screenPadding,
    padding: sizes.screenPadding,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldBlock: {
    flex: 1,
    gap: spacing.s,
  },
  group: {
    gap: 7,
  },
  intervalGroup: {
    gap: 10,
  },
  hint: {
    fontFamily: fonts.ui,
    fontSize: 12.5,
    lineHeight: 12.5 * 1.45,
  },
  error: {
    fontFamily: fonts.uiMedium,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.sm,
  },
  deleteButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
  },
  deleteLabel: {
    fontFamily: fonts.uiSemibold,
    fontSize: 14,
  },
});
