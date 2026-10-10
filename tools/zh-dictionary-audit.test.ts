import { describe, expect, test } from 'bun:test';
import { dict as en, type I18nKey } from '../packages/ui/src/lib/i18n/messages/en';
import { dict as zh } from '../packages/ui/src/lib/i18n/messages/zh-CN';
import { formatMessage } from '../packages/ui/src/lib/i18n/store';

const placeholders = (value: string) => [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort();
const cjk = /[\u3400-\u9fff]/;
const latinWord = /[A-Za-z]{3,}/;

/**
 * Values that deliberately stay identical to English: product/vendor/model names,
 * protocols, paths, placeholders, unit tokens and shortcut glyphs. Anything outside
 * this set with an identical English/Chinese value is treated as an untranslated gap.
 */
const intentionalEnglish = new Set([
  'MCP', 'OpenChamber', 'OpenCode', 'Git', 'GitHub', 'GitLab', 'Linear', 'OpenChamber Relay',
  'OpenCode CLI', 'OpenChamber Web', 'Claude Code', 'Excalidraw', 'OAuth', 'CLI', 'SSH',
  'OpenAI', 'OpenAI Chat Completions', 'OpenAI Responses', 'Anthropic Messages', 'Say',
  'Vim', 'Bash', 'Markdown', 'WebSocket', 'SSE', 'SVG', 'ASCII', 'PDF', 'API', 'Top P',
  'Git LFS', 'HEAD', 'Esc', 'Ctrl', 'Alt', 'Enter', 'Cron', 'Code Mode', 'WebFetch',
  'Token', 'Issue', 'plan', 'Relay', 'value', 'agents', 'opencode', 'claude', 'AI', 'glab CLI',
  'snippet-name', 'safe, careful', 'https://host:port', 'openchamber://connect?...',
  '127.0.0.1', '.openchamber/plans', 'agent-name', 'command-name', 'skill-name',
  'name@example.com', '~/.ssh/id_ed25519.pub', '/Users/you/.bun/bin/opencode',
  'ssh user@host', 'user@host', 'my-provider', 'https://api.example.com/v1',
  'gpt-4o', 'GPT-4o', 'low, medium, high', 'X-Custom-Header', 'sk-...', 'my-mcp-server',
  'https://mcp.example.com/mcp', 'Header-Name', 'API_KEY', '{last_message}',
  'https://example.com/.well-known/oauth-authorization-server',
  'feature/my-awesome-feature', 'my-worktree-directory', 'http://192.168.1.74:2606',
  'https://your-server.example.com:4096', 'new_directory', '*/5 * * * *',
  '2026-07-28', '→ {action}', '{current} → {latest}', ' + 1…9', ' + 1…0',
  '{count}d', '{count}w', '{count}y', '{value} · {share}', 'PR {id}',
  'PR #{number}', 'MR !{number}', 'Issue #{number}', '#{number}',
  '{behind}↓ {ahead}↑', '{current} / {total}', '{model} · {status}',
  '{input} ↑ · {output} ↓', 'A → Z', 'Z → A', '—', '?',
  'GitHub：{login}', 'GitLab：{login}', 'Cron：{cron}', 'Cron：{cron}（{timezone}）',
  '',
]);

describe('Chinese dictionary audit (v2.2.0 baseline)', () => {
  test('every English key is present in the Chinese dictionary', () => {
    const missing: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      // A few keys are intentionally empty strings in every locale.
      if (zh[key] === undefined) missing.push(key as string);
    }
    expect(missing).toEqual([]);
  });

  test('Chinese messages do not drop English placeholders', () => {
    // Chinese may add placeholders (e.g. {count}); it must never lose an English one.
    const dropped: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      const enVars = placeholders(en[key]);
      const zhVars = placeholders(zh[key] ?? '');
      const missing = enVars.filter(v => !zhVars.includes(v));
      if (missing.length) dropped.push(`${key} missing ${JSON.stringify(missing)}`);
    }
    expect(dropped).toEqual([]);
  });

  test('identical English and Chinese values are reviewed technical literals only', () => {
    const unexpected: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      if (en[key] === zh[key] && !intentionalEnglish.has(en[key])) {
        unexpected.push(`${key} => ${JSON.stringify(en[key])}`);
      }
    }
    expect(unexpected).toEqual([]);
  });

  test('visible non-technical prose is translated', () => {
    // Flag values that read like English prose (>= 3 consecutive English words) but
    // contain no Chinese characters and are not a reviewed technical literal.
    const proseLike = /(?:[A-Za-z][A-Za-z']*\s+){2,}[A-Za-z][A-Za-z']*/;
    const untranslated: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      const value = zh[key] ?? '';
      if (intentionalEnglish.has(en[key])) continue;
      if (cjk.test(value)) continue;
      // Ignore strings that are only placeholders, symbols or a short label.
      if (!proseLike.test(value)) continue;
      untranslated.push(`${key} => ${JSON.stringify(value)}`);
    }
    expect(untranslated).toEqual([]);
  });

  test('key locale fixes render genuine Chinese with dynamic values intact', () => {
    const expected: Record<string, string> = {
      'settings.view.home.title': '设置',
      'settings.appearance.language.label': '语言',
      'common.relative.justNow': '刚刚',
      'common.date.today': '今天',
      'common.language.english': '英语',
      'mobile.changes.diffDetail.subtitle': '只读 diff',
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(formatMessage(zh, key as I18nKey), key).toBe(value);
    }
    expect(formatMessage(zh, 'common.relative.minutesAgoShort', { count: 2 })).toBe('2分钟前');
    expect(formatMessage(zh, 'common.relative.hoursAgoShort', { count: 3 })).toBe('3小时前');
  });
});
