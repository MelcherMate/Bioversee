import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { loadAppearance } from "../lib/appearance";
import de from "./locales/de.json";
import en from "./locales/en.json";
import hu from "./locales/hu.json";

const initial = loadAppearance().language;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    hu: { translation: hu },
  },
  lng: initial,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
