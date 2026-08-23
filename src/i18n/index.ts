import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { getSetting, setSetting } from '../db/repositories';
import ru from './locales/ru';
import en from './locales/en';

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const SETTING_KEY = 'language';

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'ru' ? 'ru' : 'en';
}

export async function initI18n(): Promise<void> {
  const stored = await getSetting(SETTING_KEY);
  const language: Language =
    stored === 'ru' || stored === 'en' ? stored : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: { ru: { translation: ru }, en: { translation: en } },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
  await setSetting(SETTING_KEY, language);
}

export function currentLanguage(): Language {
  return i18n.language === 'ru' ? 'ru' : 'en';
}

export default i18n;
