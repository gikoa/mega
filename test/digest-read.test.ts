import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

// runs/ is read-only (AGENTS.md), so nights we write live in a temp dir.
const tmpRuns = mkdtempSync(`${tmpdir()}/rig-digest-`);
afterAll(() => rmSync(tmpRuns, { recursive: true, force: true }));

function night(name: string, lines: string) {
  writeFileSync(`${tmpRuns}/${name}.jsonl`, lines);
  return readNight(tmpRuns, name);
}

describe('readNight', () => {
  it('reads the real night into one row per job', () => {
    const result = readNight('runs', '2026-10-28');
    expect(result?.night).toBe('2026-10-28');
    expect(result?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(result?.badLines).toBe(1);
  });

  it('counts runs and retries and takes the last status by time, offsets kept', () => {
    const rows = readNight('runs', '2026-10-28')?.rows ?? [];
    expect(rows.find((r) => r.job === 'lane/sync')).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
    expect(rows.find((r) => r.job === 'fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
  });

  it('keeps a row whose owner is null', () => {
    const row = readNight('runs', '2026-10-28')?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
  });

  it('returns null when the night has no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });

  it('reads an empty night as no rows and no bad lines', () => {
    expect(night('2026-01-01', '')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('ignores blank lines and counts unusable ones without throwing', () => {
    const result = night(
      '2026-01-02',
      [
        '',
        '   ',
        'not json',
        '{"at":"2026-01-02T23:00:00+01:00","job":"a/one","status":"nope","owner":"rook"}',
        '{"at":"2026-01-02T23:00:00+01:00","status":"ok","owner":"rook"}',
        '{"at":"later","job":"a/one","status":"ok","owner":"rook"}',
        '{"at":"2026-01-02T23:00:01+01:00","job":"a/one","status":"ok","owner":"rook"}',
        '',
      ].join('\n'),
    );
    expect(result?.badLines).toBe(4);
    expect(result?.rows).toHaveLength(1);
    expect(result?.rows[0]).toMatchObject({ job: 'a/one', runs: 1, lastStatus: 'ok' });
  });
});
