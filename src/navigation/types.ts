import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Service: undefined;
  Parts: undefined;
  Expenses: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  PartDetail: { partId: string };
  PartsCatalog: undefined;
  /** Без partId — создание своей запчасти, с ним — редактирование. */
  PartForm: { partId?: string } | undefined;
  RecordForm: { recordId?: string } | undefined;
  CarForm: { carId?: string } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
