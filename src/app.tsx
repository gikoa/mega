import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  // Edge check: the name goes into a file path.
  const lookup = (night: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(night) ? readNight(config.runsDir, night) : null;

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = lookup(night);
    if (data === null) return c.text('no such night', 404);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={data} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const data = lookup(c.req.param('night'));
    if (data === null) return c.json({ error: 'no such night' }, 404);
    return c.json(data);
  });

  return app;
}
