import 'dotenv/config';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Set it in backend/.env or the environment.');
}

export const pool = new Pool({ connectionString });
