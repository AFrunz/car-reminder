import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Car } from '../domain/types';
import { getSetting, listCars, setSetting } from '../db/repositories';

/**
 * Активная машина хранится в настройках, чтобы приложение открывалось там же, где
 * его закрыли. `revision` увеличивается после любой записи в базу — экраны
 * подписываются на него и перезагружают свои данные, не заводя общий кэш.
 */

interface GarageContextValue {
  cars: Car[];
  activeCar: Car | null;
  loading: boolean;
  revision: number;
  setActiveCar: (carId: string) => void;
  /** Вызывать после любой мутации данных. */
  refresh: () => void;
}

const GarageContext = createContext<GarageContextValue | null>(null);

const SETTING_KEY = 'activeCarId';

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [activeCarId, setActiveCarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(async () => {
    const [loaded, storedId] = await Promise.all([listCars(), getSetting(SETTING_KEY)]);
    setCars(loaded);
    setActiveCarId((current) => {
      const candidate = current ?? storedId;
      const exists = loaded.some((car) => car.id === candidate);
      return exists ? candidate : (loaded[0]?.id ?? null);
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  const value = useMemo<GarageContextValue>(
    () => ({
      cars,
      activeCar: cars.find((car) => car.id === activeCarId) ?? null,
      loading,
      revision,
      setActiveCar: (carId) => {
        setActiveCarId(carId);
        void setSetting(SETTING_KEY, carId);
      },
      refresh: () => setRevision((value) => value + 1),
    }),
    [cars, activeCarId, loading, revision],
  );

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export function useGarage(): GarageContextValue {
  const context = useContext(GarageContext);
  if (!context) throw new Error('useGarage используется вне GarageProvider');
  return context;
}
