# AgriProvider API

The API uses the Neon PostgreSQL database configured by `DATABASE_URL` in
`backend/.env`. Keep that file private; it is ignored by Git.

## Run

From this directory, install dependencies, apply the schema, and start the API:

```sh
npm install
npm run db:schema
npm run dev
```

The server listens on port `3000` on all network interfaces. Set `PORT` to
override the default.

## Attendance sync

`POST /api/attendance/sync` accepts a JSON body containing 1–100 records. Each
record can contain multiple learners. The API writes one row per learner to the
`attendance` table in a PostgreSQL transaction. The `(record_id, learner_id)`
unique constraint makes retries safe.

The response contains `syncedIds` for accepted records and `duplicateIds` for
records already stored.

## Credentials

The `users.password` column is intended for one-way password hashes only. Never
store plaintext passwords.
