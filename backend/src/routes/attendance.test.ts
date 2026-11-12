import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../app.js';

const testRecord = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  date: '2026-11-11T00:00:00.000Z',
  synced: false,
  learners: [
    { learnerId: 'L-1042', learnerName: 'Ayanda Mokoena', status: 'Present' },
    { learnerId: 'L-1087', learnerName: 'Lerato Khumalo', status: 'Absent' },
  ],
};

function createMockPool() {
  const attendance = new Set<string>();
  const pool = {
    async connect() {
      const client = {
        async query(query: string, values?: unknown[]) {
          if (query.startsWith('INSERT INTO attendance')) {
            const key = `${String(values?.[0])}:${String(values?.[1])}`;
            if (attendance.has(key)) return { rows: [], rowCount: 0 };
            attendance.add(key);
            return { rows: [{ id: 'generated-uuid' }], rowCount: 1 };
          }
          return { rows: [], rowCount: null };
        },
        release() {},
      };
      return client;
    },
  };
  return { pool, attendance };
}

test('attendance sync is idempotent for a UUID and every learner', async (t) => {
  const { pool, attendance } = createMockPool();
  const server = createApp(pool).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/attendance/sync`;
  const request = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [testRecord] }),
    });

  const firstResponse = await request();
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(await firstResponse.json(), {
    syncedIds: [testRecord.id],
    duplicateIds: [],
  });
  assert.equal(attendance.size, testRecord.learners.length);

  const retryResponse = await request();
  assert.equal(retryResponse.status, 200);
  assert.deepEqual(await retryResponse.json(), {
    syncedIds: [testRecord.id],
    duplicateIds: [testRecord.id],
  });
  assert.equal(attendance.size, testRecord.learners.length);
});

test('attendance sync rejects invalid record UUIDs', async (t) => {
  const { pool } = createMockPool();
  const server = createApp(pool).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/attendance/sync`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ ...testRecord, id: 'invalid' }] }),
    },
  );

  assert.equal(response.status, 400);
});
