import { create } from 'zustand';

import { dict as enDict, type I18nKey } from './messages/en';
import { dict as zhCnDict } from './messages/zh-CN';
import { dict as zhTwDict } from './messages/zh-TW';
import { zhForkI18n } from './messages/zh-fork.i18n';
import { DEFAULT_LOCALE, detectInitialLocale, type Locale, writeStoredLocale } from './runtime';

export type I18nParams = Record<string, string | number | boolean | null | undefined>;
export type I18nDictionary = Record<I18nKey, string>;

type I18nState = {
  locale: Locale;
  dictionary: I18nDictionary;
  loadingLocale: Locale | null;
  setLocale: (locale: Locale) => void;
};

// The Chinese fork keeps its own keys in the Chinese dictionaries, so a locale
// loaded from upstream's files answers those from English, which is what the app
// falls back to anyway. The fork's dictionaries already carry them.
const withForkKeys = (dictionary: object): I18nDictionary => ({
  ...zhForkI18n.en,
  ...dictionary,
}) as I18nDictionary;

const dictionaries = new Map<Locale, I18nDictionary>([
  ['en', withForkKeys(enDict)],
  ['zh-CN', withForkKeys(zhCnDict)],
  ['zh-TW', withForkKeys(zhTwDict)],
]);

export function resetI18nDictionaryCacheForTests(): void {
  dictionaries.clear();
  dictionaries.set('en', withForkKeys(enDict));
  dictionaries.set('zh-CN', withForkKeys(zhCnDict));
  dictionaries.set('zh-TW', withForkKeys(zhTwDict));
}

async function loadDictionary(locale: Locale): Promise<I18nDictionary> {
  const cached = dictionaries.get(locale);
  if (cached) {
    return cached;
  }

  const mod = locale === 'zh-CN'
    ? { dict: withForkKeys(zhCnDict) }
    : locale === 'fr'
      ? await import('./messages/fr') as { dict: I18nDictionary }
      : locale === 'nl'
        ? await import('./messages/nl') as { dict: I18nDictionary }
    : locale === 'zh-TW'
      ? { dict: withForkKeys(zhTwDict) }
      : locale === 'es'
        ? await import('./messages/es') as { dict: I18nDictionary }
        : locale === 'pt-BR'
          ? await import('./messages/pt-BR') as { dict: I18nDictionary }
          : locale === 'uk'
            ? await import('./messages/uk') as { dict: I18nDictionary }
            : locale === 'ko'
              ? await import('./messages/ko') as { dict: I18nDictionary }
              : locale === 'pl'
                ? await import('./messages/pl') as { dict: I18nDictionary }
                : locale === 'de'
                  ? await import('./messages/de') as { dict: I18nDictionary }
                  : locale === 'ja'
                    ? await import('./messages/ja') as { dict: I18nDictionary }
                    : locale === 'tr'
                      ? await import('./messages/tr') as { dict: I18nDictionary }
                      : locale === 'ar'
                        ? await import('./messages/ar')
                        : locale === 'he'
                          ? await import('./messages/he')
                          : { dict: withForkKeys(enDict) };
  const dictionary = withForkKeys(mod.dict);
  dictionaries.set(locale, dictionary);
  return dictionary;
}

export const useI18nStore = create<I18nState>()((set, get) => ({
  locale: DEFAULT_LOCALE,
  dictionary: dictionaries.get(DEFAULT_LOCALE) ?? withForkKeys(enDict),
  loadingLocale: null,
  setLocale: (locale) => {
    const current = get();
    const cached = dictionaries.get(locale);
    if (current.locale === locale && current.loadingLocale !== locale && cached && current.dictionary === cached) {
      return;
    }

    writeStoredLocale(locale);

    set({
      locale,
      dictionary: cached ?? current.dictionary,
      loadingLocale: cached ? null : locale,
    });

    if (cached) {
      return;
    }

    void loadDictionary(locale).then((dictionary) => {
      if (get().locale !== locale) {
        return;
      }
      set({ dictionary, loadingLocale: null });
    }).catch((error) => {
      console.error(`[i18n] failed to load locale ${locale}`, error);
      if (get().locale === locale) {
        set({ dictionary: enDict, loadingLocale: null });
      }
    });
  },
}));

export function initializeLocale(): void {
  useI18nStore.getState().setLocale(detectInitialLocale());
}

export function formatMessage(dictionary: I18nDictionary, key: I18nKey, params?: I18nParams): string {
  const template = dictionary[key] ?? enDict[key] ?? key;
  if (!params) {
    return template;
  }

  return template.replace(/\{([^{}]+)\}/g, (match, rawKey) => {
    const value = params[rawKey.trim()];
    return value === null || value === undefined ? match : String(value);
  });
}

export type { I18nKey, Locale };
