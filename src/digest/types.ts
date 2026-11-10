export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night.
export type DigestRow = {
  job: string;
  owner: string | null; // null is kept; the view shows it as —
  runs: number; // lines seen for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string; // the log's own string, offset kept (styleguide)
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job, so the page and the JSON cannot disagree
  badLines: number; // lines that did not parse
};

// null when runs/<night>.jsonl does not exist, so routes can answer 404.
export type ReadNight = (runsDir: string, night: string) => Night | null;
