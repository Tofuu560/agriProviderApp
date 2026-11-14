import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { z,ZodError } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';

const webDist = fileURLToPath(new URL('../../mobile/dist', import.meta.url));
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};
import { db,AppError,fail,hash,mutate,audit,system } from './core.js';
import { accountRoutes } from './account.js';
import { authRoutes } from './auth.js';
import { adminRoutes } from './admin.js';
import { domainRoutes } from './domain.js';
import {onboardingRoutes} from './onboarding.js';
import {learnerPackRoutes} from './learner-packs.js';
import {learningRoutes} from './learning.js';
import { storage } from './storage.js';
export async function createApp(){
 const app=Fastify({logger:env.NODE_ENV==='production'?{redact:['req.headers.authorization','req.headers.cookie','req.body','res.headers.set-cookie']}:false,bodyLimit:1024*1024});
 await app.register(cookie);await app.register(helmet,{contentSecurityPolicy:false});
 const allowed=env.CORS_ORIGINS.split(',');
 await app.register(cors,{origin:(origin,cb)=>cb(null,!origin||allowed.includes(origin)),credentials:true});
 await app.register(rateLimit,{max:300,timeWindow:'1 minute'});
 await app.register(multipart,{limits:{files:1,fields:2,fileSize:20*1024*1024}});
 app.addHook('onRequest',async req=>{
  // Cookie-based refresh is protected by an exact Origin allow-list.
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin&&!allowed.includes(req.headers.origin))fail('INVALID_ORIGIN','This origin is not permitted.',403);
 });
 app.setErrorHandler((e,req,reply)=>{
  if(e instanceof ZodError)return reply.status(400).send({code:'VALIDATION_ERROR',message:e.issues[0]?.message??'Check the form.',fields:e.issues.map(i=>({path:i.path.join('.'),message:i.message}))});
  if(e instanceof AppError)return reply.status(e.statusCode).send({code:e.code,message:e.message,fields:[]});
  if((e as any).code==='P2002')return reply.status(409).send({code:'DUPLICATE_RECORD',message:'A record with these details already exists.',fields:[]});
  if((e as any).code==='P2025')return reply.status(404).send({code:'NOT_FOUND',message:'Record not found.',fields:[]});
  const status=(e as any).statusCode;
  if(status&&status<500)return reply.status(status).send({code:'REQUEST_REJECTED',message:status===413?'File is too large.':status===429?'Too many attempts. Please wait and try again.':'The request could not be accepted.',fields:[]});
  req.log.error({code:(e as any).code,name:(e as any).name},'Request failed');
  return reply.status(500).send({code:'INTERNAL_ERROR',message:'Something went wrong. Please try again.',fields:[]});
 });
 app.get('/healthz',async()=>({status:'ok',version:'1.0.0'}));
 app.get('/readyz',async(_req,reply)=>{try{await db.$queryRaw`SELECT 1`;return {status:'ready'};}catch{return reply.status(503).send({status:'warming',message:'Waking the server…'});}});
 await authRoutes(app);await accountRoutes(app);await adminRoutes(app);await domainRoutes(app);await onboardingRoutes(app);await learningRoutes(app);await learnerPackRoutes(app);
 app.get('/files/:key',async(req,reply)=>{
  const {key}=z.object({key:z.string().uuid()}).parse(req.params);
  const {expires,signature}=z.object({expires:z.coerce.number(),signature:z.string().regex(/^[a-f0-9]{64}$/)}).parse(req.query);
  if(expires<Date.now()||expires>Date.now()+121000||!timingSafeEqual(Buffer.from(signature),Buffer.from(hash(key+':'+expires))))fail('EXPIRED_LINK','This download link has expired.',403);
  const e=await db.evidence.findFirst({where:{storageKey:key}});if(!e)fail('NOT_FOUND','File not found.',404);
  return reply.type(e.mime).header('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(e.fileName)).header('Cache-Control','no-store').send(await storage.read(key));
 });
 app.addHook('preHandler',async req=>{
  if(!req.url.startsWith('/api/v1/integrations/'))return;
  const raw=req.headers.authorization?.replace(/^Bearer /,'');const k=raw?await db.apiKey.findUnique({where:{hash:hash(raw)}}):null;
  const scope=req.url.includes('/findings')?'findings:write':req.url.includes('/certifications')?'certifications:read':'programmes:read';
  if(!k||k.revokedAt||k.expiresAt<new Date()||!k.scopes.includes(scope))fail('INVALID_KEY','This integration key does not have access.',403);
 });
 app.get('/api/v1/integrations/programmes',async()=>db.programme.findMany({select:{id:true,name:true,level:true,assessmentType:true},take:100}));
 app.get('/api/v1/integrations/certifications',async()=>db.certificationEvent.findMany({where:{milestone:{state:'UNLOCKED'}},take:100,orderBy:{createdAt:'desc'}}));
 app.post('/api/v1/integrations/findings',async req=>{
  const v=z.object({providerId:z.string().uuid(),officerName:z.string().min(2),region:z.string().min(2),description:z.string().min(10),clientOpId:z.string().uuid()}).strict().parse(req.body);
  // Integration actor is a fixed UUID namespace for idempotency; no human session is accepted.
  return mutate({...system,id:'00000000-0000-4000-8000-000000000001'},v.clientOpId,v,async tx=>{if(!await tx.provider.findUnique({where:{id:v.providerId}}))fail('NOT_FOUND','Provider not found.',404);const {clientOpId,...data}=v;const f=await tx.finding.create({data});await audit(tx,system,'FIELD_FINDING_RECEIVED',f.id,{},clientOpId);return f;});
 });
 app.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/files/') || req.url === '/healthz' || req.url === '/readyz') {
    return reply.status(404).send({code:'NOT_FOUND',message:'Endpoint not found.',fields:[]});
  }
  try {
    const cleanPath = req.url.split('?')[0];
    const filePath = join(webDist, cleanPath === '/' ? 'index.html' : cleanPath);
    const s = await stat(filePath).catch(() => null);
    if (s && s.isFile()) {
      const ext = extname(filePath).toLowerCase();
      const type = mimeTypes[ext] || 'application/octet-stream';
      return reply.type(type).send(await readFile(filePath));
    }
    const indexPath = join(webDist, 'index.html');
    return reply.type('text/html; charset=utf-8').send(await readFile(indexPath));
  } catch {
    return reply.status(404).send({code:'NOT_FOUND',message:'Endpoint not found.',fields:[]});
  }
 });
 return app;
}
