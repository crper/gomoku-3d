import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { zh } from "./locales/zh";
import { en } from "./locales/en";

export const resources = {
  zh: { translation: zh },
  en: { translation: en },
} as const;

export const SUPPORTED_LANGS = ["zh", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    // Map region variants (e.g. "zh-CN" / "en-US") onto the base language.
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "gomoku-lang",
    },
  });

export default i18n;
