import { PrismaClient, Prisma, type User } from '@prisma/client';
import { createCipheriv,createDecipheriv,createHmac,randomBytes,createHash } from 'node:crypto';
import { env } from './config.js';
import { defaultSettings, settingsSchema, type Role } from '@agri/shared';
export const db=new PrismaClient();
export type Tx=Prisma.TransactionClient;
export type Actor=Pick<User,'id'|'role'|'providerId'|'fullName'|'email'>;
export class AppError extends Error { constructor(public statusCode:number,public code:string,message:string){super(message);} }
export function fail(code:string,message:string,status=400):never {throw new AppError(status,code,message);}
export const hash=(v:string)=>createHmac('sha256',env.TOKEN_KEY).update(v).digest('hex');
export const checksum=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
export const token=()=>randomBytes(32).toString('base64url');
export function encrypt(v:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from(env.ENCRYPTION_KEY,'hex'),iv);return (()=>{const b=Buffer.concat([c.update(v,'utf8'),c.final()]);return [iv.toString('hex'),c.getAuthTag().toString('hex'),b.toString('hex')].join('.');})();}
export function decrypt(v:string){const [iv,tag,data]=v.split('.');const c=createDecipheriv('aes-256-gcm',Buffer.from(env.ENCRYPTION_KEY,'hex'),Buffer.from(iv,'hex'));c.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([c.update(Buffer.from(data,'hex')),c.final()]).toString('utf8');}
export async function settings(tx:Tx=db){const s=await tx.systemSetting.findFirst({orderBy:{version:'desc'}});return s?settingsSchema.parse(s.value):defaultSettings;}
export function audit(tx:Tx,actor:Actor,action:string,entityId:string,details:Prisma.InputJsonValue={},clientOpId?:string){return tx.auditLog.create({data:{actorId:actor.id,role:actor.role,action,entityId,details,clientOpId}});}
export async function transaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>{
 return db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(623891)`;return fn(tx);},{timeout:20000});
}
export async function mutate<T>(actor:Actor,op:string|undefined,body:unknown,fn:(tx:Tx)=>Promise<T>):Promise<T>{
 return transaction(async tx=>{
  const fingerprint=hash(JSON.stringify(body));
  if(op){const old=await tx.syncOperation.findUnique({where:{userId_clientOpId:{userId:actor.id,clientOpId:op}}});if(old){if(old.requestHash!==fingerprint)fail('OP_CONFLICT','This operation ID was already used for different data.',409);return old.result as T;}}
  const result=await fn(tx);
  if(op)await tx.syncOperation.create({data:{userId:actor.id,clientOpId:op,requestHash:fingerprint,result:result as Prisma.InputJsonValue}});
  return result;
 });
}
export async function assertProvider(tx:Tx,providerId:string,write=false){const p=await tx.provider.findUnique({where:{id:providerId}});if(!p)fail('NOT_FOUND','Record not found.',404);if(write&&(p.status!=='ACCREDITED'||p.validTo<new Date()))fail('PROVIDER_SUSPENDED','This provider is suspended or its accreditation has expired. Contact your administrator.',409);return p;}
export async function cohortFor(tx:Tx,actor:Actor,id:string,write=false){
 const c=await tx.cohort.findUnique({where:{id},include:{provider:true,programme:true,enrolments:{include:{learner:true}},sessions:{orderBy:{startsAt:'asc'},include:{attendance:true}},milestones:{include:{evidence:true,findings:true}},assessments:true,moderation:{orderBy:{createdAt:'desc'}},assignments:true}});
 if(!c||(actor.role==='PROVIDER'&&c.providerId!==actor.providerId)||(actor.role==='ASSESSOR'&&!c.assignments.some(a=>a.userId===actor.id&&a.active)))fail('NOT_FOUND','Record not found.',404);
 if(write){await assertProvider(tx,c.providerId,true);if(c.status!=='ACTIVE')fail('COHORT_CLOSED','This cohort is not active.',409);}
 return c;
}
export async function notify(tx:Tx,roles:Role[],message:string,providerId?:string,cohortId?:string){const users=await tx.user.findMany({where:{status:'ACTIVE',role:{in:roles},AND:[...(providerId?[{OR:[{providerId},{role:{not:'PROVIDER'}}]}]:[]),...(cohortId?[{OR:[{role:{not:'ASSESSOR'}},{assignments:{some:{cohortId,active:true}}}]}]:[])]}});if(users.length)await tx.notification.createMany({data:users.map(u=>({userId:u.id,message}))});await tx.outboxEvent.create({data:{type:'NOTIFICATION',payload:{message,userIds:users.map(u=>u.id)}}});}
export function publicUser(u:User){return {id:u.id,email:u.email,fullName:u.fullName,role:u.role as Role,providerId:u.providerId,status:u.status,mfaEnabled:u.mfaEnabled};}
export const system:Actor={id:'system',role:'SYSTEM',providerId:null,email:'system',fullName:'System'};
export async function connect(){for(let attempt=0;attempt<5;attempt++){try{await db.$connect();await db.$queryRaw`SELECT 1`;return;}catch(e){if(attempt===4)throw e;await new Promise(r=>setTimeout(r,250*2**attempt));}}}
