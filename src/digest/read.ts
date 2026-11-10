import { readFileSync } from 'node:fs';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// Parse at the edge (styleguide): unknown text in, a usable line or null out.
function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const line = value as Record<string, unknown>;
  const { at, job, status, owner, error } = line;
  if (typeof job !== 'string' || job === '') return null;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  return {
    at,
    job,
    status,
    owner: typeof owner === 'string' ? owner : null,
    error: typeof error === 'string' ? error : null,
  };
}

export const readNight: ReadNight = (runsDir, night): Night | null => {
  let text: string;
  try {
    text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '') continue; // blank lines are nothing, not bad lines
    const line = parseLine(trimmed);
    if (line === null) {
      badLines += 1;
      continue;
    }
    const row = byJob.get(line.job);
    if (row === undefined) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    // Compared as instants, kept as the log's own strings: offsets can differ on a DST night.
    if (Date.parse(line.at) < Date.parse(row.firstAt)) row.firstAt = line.at;
    if (Date.parse(line.at) >= Date.parse(row.lastAt)) {
      row.lastAt = line.at;
      row.lastStatus = line.status;
      row.lastError = line.error;
      row.owner = line.owner;
    }
  }

  return {
    night,
    rows: [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : 1)),
    badLines,
  };
};
