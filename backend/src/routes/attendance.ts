import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

export type AttendancePool = {
  connect: () => Promise<{
    query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }>;
    release: () => void;
  }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStatuses = new Set(['Present', 'Absent', 'Late']);

type AttendanceRecord = {
  id: string;
  date: string;
  synced: false;
  learners: Array<{
    learnerId: string;
    learnerName: string;
    status: 'Present' | 'Absent' | 'Late';
  }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAttendanceLearner(
  learner: unknown,
): learner is AttendanceRecord['learners'][number] {
  return (
    isObject(learner) &&
    typeof learner.learnerId === 'string' &&
    learner.learnerId.length > 0 &&
    learner.learnerId.length <= 100 &&
    typeof learner.learnerName === 'string' &&
    learner.learnerName.length > 0 &&
    learner.learnerName.length <= 150 &&
    typeof learner.status === 'string' &&
    allowedStatuses.has(learner.status)
  );
}

function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!isObject(value)) return false;
  if (
    typeof value.id !== 'string' ||
    !uuidPattern.test(value.id) ||
    typeof value.date !== 'string' ||
    !Number.isFinite(Date.parse(value.date)) ||
    value.synced !== false ||
    !Array.isArray(value.learners) ||
    value.learners.length === 0 ||
    value.learners.length > 200
  ) {
    return false;
  }

  if (!value.learners.every(isAttendanceLearner)) return false;
  return new Set(value.learners.map((learner) => learner.learnerId)).size === value.learners.length;
}

export function createAttendanceRouter(pool: AttendancePool) {
  const router = Router();

  router.post(
    '/sync',
    async (req: Request, res: Response, next: NextFunction) => {
      const body: unknown = req.body;
      if (
        !isObject(body) ||
        !Array.isArray(body.records) ||
        body.records.length === 0 ||
        body.records.length > 100
      ) {
        res.status(400).json({ error: 'Provide between 1 and 100 attendance records.' });
        return;
      }

      if (!body.records.every(isAttendanceRecord)) {
        res.status(400).json({ error: 'One or more attendance records are invalid.' });
        return;
      }

      const records = body.records;
      if (new Set(records.map((record) => record.id)).size !== records.length) {
        res.status(400).json({ error: 'Each attendance record must have a unique UUID.' });
        return;
      }

      const client = await pool.connect();
      let transactionStarted = false;

      try {
        await client.query('BEGIN');
        transactionStarted = true;
        const syncedIds: string[] = [];
        const duplicateIds: string[] = [];

        for (const record of records) {
          let recordWasAlreadySynced = true;

          for (const learner of record.learners) {
            const result = await client.query(
              `INSERT INTO attendance (record_id, learner_id, status, synced)
               VALUES ($1, $2, $3, TRUE)
               ON CONFLICT (record_id, learner_id) DO NOTHING
               RETURNING id`,
              [record.id, learner.learnerId, learner.status],
            );
            if (result.rowCount !== 0) recordWasAlreadySynced = false;
          }

          syncedIds.push(record.id);
          if (recordWasAlreadySynced) duplicateIds.push(record.id);
        }

        await client.query('COMMIT');
        transactionStarted = false;
        res.status(200).json({ syncedIds, duplicateIds });
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('Failed to roll back attendance sync transaction', rollbackError);
          }
        }
        next(error);
      } finally {
        client.release();
      }
    },
  );

  return router;
}
