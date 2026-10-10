import { beforeEach, describe, expect, test } from 'bun:test';
import { DEFAULT_LOCALE, type Locale } from './runtime';
import { initializeLocale, resetI18nDictionaryCacheForTests, useI18nStore } from './store';
import { dict as enDict } from './messages/en';
import { dict as zhCnDict } from './messages/zh-CN';

const defaultDictionary = useI18nStore.getState().dictionary;

const resetStore = () => {
  resetI18nDictionaryCacheForTests();
  useI18nStore.setState({
    locale: DEFAULT_LOCALE,
    dictionary: defaultDictionary,
    loadingLocale: null,
  });
};

const waitForLocaleLoadToSettle = async (locale: Locale) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (useI18nStore.getState().loadingLocale !== locale) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${locale} dictionary load`);
};

describe('i18n store', () => {
  beforeEach(resetStore);

  test('starts with the dictionary matching the default Chinese locale', () => {
    expect(defaultDictionary).toBe(zhCnDict);
    expect(defaultDictionary['settings.view.home.title']).toBe('设置');
  });

  test('initialization repairs an active locale whose dictionary does not match', () => {
    useI18nStore.setState({ locale: DEFAULT_LOCALE, dictionary: enDict });
    initializeLocale();
    const settled = useI18nStore.getState();
    expect(settled.dictionary).toBe(zhCnDict);
    expect(settled.dictionary['settings.view.home.title']).toBe('设置');
    expect(settled.dictionary).not.toBe(enDict);
  });

  test('switching back to cached Chinese applies the Chinese dictionary', () => {
    useI18nStore.getState().setLocale('en');
    expect(useI18nStore.getState().dictionary).toBe(enDict);
    useI18nStore.getState().setLocale('zh-CN');
    expect(useI18nStore.getState().dictionary).toBe(zhCnDict);
    expect(useI18nStore.getState().dictionary['settings.view.home.title']).toBe('设置');
  });

  test('retries loading the active locale when it is not cached', async () => {
    useI18nStore.setState({
      locale: 'es',
      dictionary: defaultDictionary,
      loadingLocale: null,
    });

    try {
      useI18nStore.getState().setLocale('es');

      expect(useI18nStore.getState().loadingLocale).toBe('es');
      await waitForLocaleLoadToSettle('es');
    } finally {
      resetStore();
    }
  });

  test('loads the french dictionary', async () => {
    try {
      useI18nStore.getState().setLocale('fr');

      expect(useI18nStore.getState().loadingLocale).toBe('fr');
      await waitForLocaleLoadToSettle('fr');
      expect(useI18nStore.getState().dictionary['common.language.french']).toBe('Français');
    } finally {
      resetStore();
    }
  });
});
