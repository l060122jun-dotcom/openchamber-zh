// Audit the zh-TW dictionary against the same rules the zh-CN audit uses.
import { describe, expect, test } from 'bun:test';
import { dict as en, type I18nKey } from '../packages/ui/src/lib/i18n/messages/en';
import { dict as zhTw } from '../packages/ui/src/lib/i18n/messages/zh-TW';

const placeholders = (value: string) => [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
const cjk = /[\u3400-\u9fff]/;

/**
 * The Traditional Chinese dictionary ships with upstream but the fork covers the
 * same gaps, so it is held to the same bar: every English key present, no English
 * placeholder dropped, and no entry left as English prose.
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
  '{input} ↑ · {output} ↓', 'A → Z', 'Z → A', '—', '?', 'beta',
  'QUICK', 'REMOTE', 'LOCAL',
  'GitHub：{login}', 'GitLab：{login}', 'Cron：{cron}', 'Cron：{cron}（{timezone}）',
  '+diff', 'plan', 'Untitled',
  '',
]);

describe('Traditional Chinese dictionary audit (v2.3.2 baseline)', () => {
  test('every English key is present in the Traditional Chinese dictionary', () => {
    const missing: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      if (zhTw[key] === undefined) missing.push(key as string);
    }
    expect(missing).toEqual([]);
  });

  test('Traditional Chinese messages do not drop English placeholders', () => {
    const dropped: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      const enVars = placeholders(en[key]);
      const zhVars = placeholders(zhTw[key] ?? '');
      const missing = enVars.filter((v) => !zhVars.includes(v));
      if (missing.length) dropped.push(`${key} missing ${JSON.stringify(missing)}`);
    }
    expect(dropped).toEqual([]);
  });

  test('identical English and Traditional Chinese values are reviewed technical literals only', () => {
    const unexpected: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      if (en[key] === zhTw[key] && !intentionalEnglish.has(en[key])) {
        unexpected.push(`${key} => ${JSON.stringify(en[key])}`);
      }
    }
    expect(unexpected).toEqual([]);
  });

  test('visible non-technical Traditional Chinese prose is translated', () => {
    const proseLike = /(?:[A-Za-z][A-Za-z']*\s+){2,}[A-Za-z][A-Za-z']*/;
    const untranslated: string[] = [];
    for (const key of Object.keys(en) as I18nKey[]) {
      const value = zhTw[key] ?? '';
      if (intentionalEnglish.has(en[key])) continue;
      if (cjk.test(value)) continue;
      if (!proseLike.test(value)) continue;
      untranslated.push(`${key} => ${JSON.stringify(value)}`);
    }
    expect(untranslated).toEqual([]);
  });
});
