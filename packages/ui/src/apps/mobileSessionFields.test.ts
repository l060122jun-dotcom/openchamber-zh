import { afterEach, describe, expect, test } from 'bun:test';
import { useI18nStore } from '@/lib/i18n';
import { formatRelativeShort } from './mobileSessionFields';

const originalLocale = useI18nStore.getState().locale;
afterEach(() => useI18nStore.getState().setLocale(originalLocale));

describe('mobile relative timestamps', () => {
  test('uses Chinese messages instead of hardcoded English units', () => {
    useI18nStore.getState().setLocale('zh-CN');
    expect(formatRelativeShort(Date.now())).toBe('刚刚');
    expect(formatRelativeShort(Date.now() - 120_000)).toContain('2');
    expect(formatRelativeShort(Date.now() - 120_000)).toContain('分钟');
    expect(formatRelativeShort(Date.now() - 7_200_000)).toContain('小时');
    expect(formatRelativeShort(Date.now() - 172_800_000)).toContain('天');
  });

  test('preserves English locale and absent timestamps', () => {
    useI18nStore.getState().setLocale('en');
    expect(formatRelativeShort(Date.now())).toBe('Just now');
    expect(formatRelativeShort(Date.now() - 120_000)).toBe('2min ago');
    expect(formatRelativeShort(0)).toBe('');
  });
});
