import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// runs/ is read-only (AGENTS.md): nights live in a temp dir.
const runsDir = mkdtempSync(`${tmpdir()}/rig-routes-`);
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);
const line = (job: string, status = 'ok') =>
  JSON.stringify({ at: '2026-11-01T01:00:00+01:00', job, status, owner: 'me', error: null });

writeFileSync(`${runsDir}/2026-11-01.jsonl`, [line('b/job'), line('a/job', 'fail'), line('c/job')].join('\n') + '\n');
writeFileSync(`${runsDir}/2026-11-02.jsonl`, '');
writeFileSync(`${runsDir}/2026-11-03.jsonl`, `${line('a/job')}\n{not json\n`);

const page = async (n: string) => app.request(`/digest/${n}`);
const api = async (n: string) => app.request(`/api/digest/${n}`);

describe('digest routes', () => {
  it('200 with the job rows', async () => {
    const p = await page('2026-11-01');
    expect(p.status).toBe(200);
    const html = await p.text();
    for (const j of ['a/job', 'b/job', 'c/job']) expect(html).toContain(j);
    const a = await api('2026-11-01');
    expect(a.status).toBe(200);
    const json = (await a.json()) as Night;
    expect(json.rows.map((r) => r.job)).toEqual(['a/job', 'b/job', 'c/job']);
  });

  it('404 for a night with no file', async () => {
    expect((await page('2026-11-09')).status).toBe(404);
    expect((await api('2026-11-09')).status).toBe(404);
  });

  it('empty night: nothing ran, rows []', async () => {
    expect(await (await page('2026-11-02')).text()).toContain('nothing ran');
    const json = (await (await api('2026-11-02')).json()) as Night;
    expect(json.rows).toEqual([]);
  });

  it('bad line: page still renders, line counted', async () => {
    const p = await page('2026-11-03');
    expect(p.status).toBe(200);
    expect(await p.text()).toContain('1 bad line(s) skipped');
    const json = (await (await api('2026-11-03')).json()) as Night;
    expect(json.badLines).toBe(1);
    expect(json.rows).toHaveLength(1);
  });

  it('page and JSON list the same jobs in the same order (ADR 0001)', async () => {
    const html = await (await page('2026-11-01')).text();
    const json = (await (await api('2026-11-01')).json()) as Night;
    const inPage = [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(inPage).toEqual(json.rows.map((r) => r.job));
    expect(inPage.length).toBeGreaterThan(0);
  });
});
