import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { createAttendanceRouter } from './routes/attendance.js';
import type { AttendancePool } from './routes/attendance.js';

export function createApp(pool: AttendancePool) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/attendance', createAttendanceRouter(pool));
  app.use(((error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }
    console.error('Unhandled API error', error);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }) satisfies ErrorRequestHandler);
  return app;
}
