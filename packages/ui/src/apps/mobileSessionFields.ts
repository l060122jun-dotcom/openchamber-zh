import type { Session } from '@/lib/opencode/model';

import { formatMessage, getCurrentIntlLocale, useI18nStore } from '@/lib/i18n';
import { normalizePath } from './mobilePaths';

/** Field readers shared by the mobile sessions sheet and its timeline list.
    Kept out of the sheet so the timeline list can read the same session
    fields without importing the sheet (which imports the list). */

export const getParentId = (session: Session): string | null =>
  (session as Session & { parentID?: string | null }).parentID ?? null;

export const getSessionDirectory = (session: Session): string => {
  const sessionWithDirectory = session as Session & {
    directory?: string | null;
    project?: { worktree?: string | null } | null;
  };
  return normalizePath(sessionWithDirectory.directory ?? sessionWithDirectory.project?.worktree ?? null);
};

export const getSessionTimestamp = (session: Session): number => {
  const raw = session.time?.updated ?? session.time?.created;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export const formatRelativeShort = (timestamp: number): string => {
  if (timestamp <= 0) return '';
  const diffMs = Date.now() - timestamp;
  const dictionary = useI18nStore.getState().dictionary;
  if (diffMs < 60_000) return formatMessage(dictionary, 'common.relative.justNow');
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return formatMessage(dictionary, 'common.relative.minutesAgoShort', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatMessage(dictionary, 'common.relative.hoursAgoShort', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return formatMessage(dictionary, 'common.relative.daysAgoShort', { count: days });
  return new Intl.DateTimeFormat(getCurrentIntlLocale(), { month: 'short', day: 'numeric' }).format(new Date(timestamp));
};
