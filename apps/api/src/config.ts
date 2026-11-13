import { config as dotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
export const env=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().default(4000),DATABASE_URL:z.string().min(1),DIRECT_URL:z.string().min(1),
 APP_URL:z.string().url(),CORS_ORIGINS:z.string(),ENCRYPTION_KEY:z.string().regex(/^[a-f0-9]{64}$/),
 TOKEN_KEY:z.string().min(32),STORAGE_MODE:z.enum(['local','s3']).default('local'),
 MAIL_MODE:z.enum(['local','smtp']).default('local'),INLINE_WORKER:z.string().default('false'),
 SMTP_URL:z.string().optional(),MAIL_FROM:z.string().default('AgriProvider <no-reply@agriprovider.local>'),
 S3_ENDPOINT:z.string().optional(),S3_BUCKET:z.string().optional(),S3_REGION:z.string().default('auto'),
 S3_ACCESS_KEY:z.string().optional(),S3_SECRET_KEY:z.string().optional(),PASSPORT_URL:z.string().url().optional(),
 PASSPORT_KEY:z.string().optional(),CLAMSCAN_PATH:z.string().optional()
}).parse(process.env);
if(env.NODE_ENV==='production'){
 if(env.STORAGE_MODE==='s3'&&(!env.S3_BUCKET||!env.S3_ACCESS_KEY||!env.S3_SECRET_KEY)) throw new Error('Production S3 mode requires S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY.');
 if(env.MAIL_MODE==='smtp'&&!env.SMTP_URL) throw new Error('Production SMTP mode requires SMTP_URL.');
 if(!env.DATABASE_URL.includes('sslmode=require')||!env.DIRECT_URL.includes('sslmode=require')) throw new Error('Production database connections require TLS.');
 if(!env.APP_URL.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS.');
}
export const dataDir=fileURLToPath(new URL('../../../.data/',import.meta.url));
