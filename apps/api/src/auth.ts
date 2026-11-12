import type { FastifyInstance,FastifyRequest,FastifyReply } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { randomUUID } from 'node:crypto';
import { loginSchema,passwordForUser,passwordSchema,permissionMatrix } from '@agri/shared';
import { db,fail,hash,token,encrypt,decrypt,settings,publicUser,audit,transaction,system,type Actor,type Tx } from './core.js';
import { env } from './config.js';
declare module 'fastify' {interface FastifyRequest {actor:Actor; sessionId:string;}}
const generic='Incorrect email or password';
const tokenMessage='This invitation is no longer valid. Ask your administrator for a new one.';
let dummyHash:string;
export async function issueToken(tx:Tx,userId:string,kind:string){
 await tx.oneTimeToken.updateMany({where:{userId,kind,usedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
 const raw=token(),s=await settings(tx);
 await tx.oneTimeToken.create({data:{userId,kind,hash:hash(raw),expiresAt:new Date(Date.now()+(kind==='INVITE'?s.inviteHours:1)*3600000)}});
 const u=await tx.user.findUniqueOrThrow({where:{id:userId}});
 const path=kind==='INVITE'?'accept-invite':'reset-password';
 // Tokens are encrypted in the delivery outbox; hashes are the only authentication lookup.
 await tx.outboxEvent.create({data:{type:'EMAIL',payload:{to:u.email,subject:kind==='INVITE'?'Your AgriProvider invitation':'Reset your AgriProvider password',encryptedText:encrypt('Open '+env.APP_URL+'/'+path+'?token='+raw+'\nThis single-use link expires. If you did not request this, ignore it.')}}});
 return raw;
}
function transport(req:FastifyRequest){return (req.body as any)?.transport==='native'?'native':'web';}
async function sessionResponse(tx:Tx,u:any,reply:FastifyReply,mode:string,existing?:any){
 const access=token(),refresh=token();
 const data={accessHash:hash(access),refreshHash:hash(refresh),accessExpiresAt:new Date(Date.now()+10*60000),lastSeen:new Date()};
 const session=existing?await tx.authSession.update({where:{id:existing.id},data:{...data,previousRefreshHashes:{push:existing.refreshHash}}}):await tx.authSession.create({data:{...data,userId:u.id,familyId:randomUUID(),expiresAt:new Date(Date.now()+7*86400000)}});
 if(mode==='web')reply.setCookie('agri_refresh',refresh,{path:'/api/v1/auth',httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',maxAge:7*86400});
 return {user:publicUser(u),accessToken:access,...(mode==='native'?{refreshToken:refresh}:{}),expiresAt:session.accessExpiresAt};
}
export async function authenticate(req:FastifyRequest){
 const access=req.headers.authorization?.replace(/^Bearer /,'');
 if(!access)fail('UNAUTHENTICATED','Please sign in to continue.',401);
 const s=await db.authSession.findUnique({where:{accessHash:hash(access)},include:{user:true}});
 const policy=await settings();
 if(!s||s.revokedAt||s.accessExpiresAt<new Date()||s.expiresAt<new Date()||s.user.status!=='ACTIVE'||Date.now()-s.lastSeen.getTime()>policy.idleMinutes*60000)fail('SESSION_EXPIRED','Your session has ended. Please sign in again.',401);
 req.actor=publicUser(s.user);req.sessionId=s.id;
 await db.authSession.update({where:{id:s.id},data:{lastSeen:new Date()}});
}
export async function authRoutes(app:FastifyInstance){
 dummyHash=await argon2.hash(token());
 app.addHook('preHandler',async req=>{
  if(!req.url.startsWith('/api/v1'))return;
  if(req.url.startsWith('/api/v1/auth/')||req.url.startsWith('/api/v1/integrations/'))return;
  await authenticate(req);
  const namespace=req.url.split('/')[3];
  if(namespace in permissionMatrix&&!(permissionMatrix as any)[namespace].includes(req.actor.role))fail('FORBIDDEN','This action is not available to your account.',403);
 });
 app.post('/api/v1/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  const input=loginSchema.parse(req.body);
  // Failed attempts must commit, so failure is returned outside the transaction.
  const result=await transaction(async tx=>{
   let u=await tx.user.findUnique({where:{email:input.email}});
   if(u?.status==='LOCKED'&&u.lockedUntil&&u.lockedUntil<new Date())u=await tx.user.update({where:{id:u.id},data:{status:'ACTIVE',failures:0,lockedUntil:null}});
   const valid=await argon2.verify(u?.passwordHash??dummyHash,input.password);
   if(!u||u.status!=='ACTIVE'||!valid){if(u&&u.status==='ACTIVE'){const n=u.failures+1;await tx.user.update({where:{id:u.id},data:{failures:n,...(n>=(await settings(tx)).lockoutAttempts?{status:'LOCKED',lockedUntil:new Date(Date.now()+15*60000)}:{})}});}return {error:true};}
   const required=u.role==='ADMIN'||(u.role==='QA_OFFICER'&&(await settings(tx)).qaMfa);
   if(required&&!u.mfaEnabled) return {enrol:true};
   if(u.mfaEnabled){const recovery=input.code?u.recoveryHashes.includes(hash(input.code)):false;if(!recovery&&(!input.code||!u.mfaSecret||!authenticator.check(input.code,decrypt(u.mfaSecret))))return {mfa:true};if(recovery)await tx.user.update({where:{id:u.id},data:{recoveryHashes:u.recoveryHashes.filter(h=>h!==hash(input.code!))}});}
   await tx.user.update({where:{id:u.id},data:{failures:0}});
   await audit(tx,u,'LOGIN',u.id);
   return sessionResponse(tx,u,reply,input.transport);
  });
  if('error'in result)fail('INVALID_LOGIN',generic,401);
  if('enrol'in result)fail('MFA_SETUP_REQUIRED','Use your invitation or password reset link to set up your authenticator.',401);
  if('mfa'in result)fail('MFA_REQUIRED','Enter the current six-digit code from your authenticator.',401);
  return result;
 });
 app.post('/api/v1/auth/refresh',async(req,reply)=>{
  const input=z.object({refreshToken:z.string().optional(),transport:z.enum(['native','web']).optional()}).parse(req.body??{});
  const raw=input.refreshToken??req.cookies.agri_refresh;
  if(!raw)fail('SESSION_EXPIRED','Please sign in again.',401);
  const h=hash(raw);
  const result=await transaction(async tx=>{
   const s=await tx.authSession.findUnique({where:{refreshHash:h},include:{user:true}});
   if(!s){const reused=await tx.authSession.findFirst({where:{previousRefreshHashes:{has:h}}});if(reused)await tx.authSession.updateMany({where:{familyId:reused.familyId},data:{revokedAt:new Date()}});return null;}
   if(s.revokedAt||s.expiresAt<new Date()||s.user.status!=='ACTIVE'||Date.now()-s.lastSeen.getTime()>(await settings(tx)).idleMinutes*60000)return null;
   return sessionResponse(tx,s.user,reply,transport(req),s);
  });
  if(!result)fail('SESSION_EXPIRED','Your session has ended. Please sign in again.',401);return result;
 });
 app.post('/api/v1/auth/logout',async(req,reply)=>{await authenticate(req);await db.authSession.update({where:{id:req.sessionId},data:{revokedAt:new Date()}});reply.clearCookie('agri_refresh',{path:'/api/v1/auth'});return {ok:true};});
 app.post('/api/v1/auth/forgot-password',{config:{rateLimit:{max:4,timeWindow:'1 minute'}}},async(req)=>{
  const {email}=z.object({email:z.string().email().transform(s=>s.toLowerCase())}).parse(req.body);
  await transaction(async tx=>{const u=await tx.user.findUnique({where:{email}});if(u&&['ACTIVE','LOCKED'].includes(u.status)){await issueToken(tx,u.id,'RESET');await audit(tx,system,'PASSWORD_RESET_REQUEST',u.id);}});
  return {message:'If an eligible account exists, a password reset link will be sent.'};
 });
 app.post('/api/v1/auth/token-info',async req=>{
  const {token:raw}=z.object({token:z.string().min(20)}).parse(req.body);
  return transaction(async tx=>{
   const t=await tx.oneTimeToken.findUnique({where:{hash:hash(raw)},include:{user:true}});
   if(!t||t.usedAt||t.revokedAt||t.expiresAt<new Date()||t.user.status==='DEACTIVATED')fail('INVALID_TOKEN',tokenMessage,400);
   const required=t.user.role==='ADMIN'||(t.user.role==='QA_OFFICER'&&(await settings(tx)).qaMfa);
   if(required&&!t.user.mfaEnabled){
    const secret=t.user.mfaSecret?decrypt(t.user.mfaSecret):authenticator.generateSecret();
    if(!t.user.mfaSecret)await tx.user.update({where:{id:t.userId},data:{mfaSecret:encrypt(secret)}});
    return {mfaRequired:true,secret,otpAuthUrl:authenticator.keyuri(t.user.email,'AgriProvider',secret)};
   }
   return {mfaRequired:t.user.mfaEnabled};
  });
 });
 for(const path of ['accept-invite','reset-password'])app.post('/api/v1/auth/'+path,async(req,reply)=>{
  const input=z.object({token:z.string(),password:passwordSchema,code:z.string().optional(),transport:z.enum(['web','native']).default('web')}).strict().parse(req.body);
  return transaction(async tx=>{
   const t=await tx.oneTimeToken.findUnique({where:{hash:hash(input.token)},include:{user:true}});
   if(!t||t.kind!==(path==='accept-invite'?'INVITE':'RESET')||t.usedAt||t.revokedAt||t.expiresAt<new Date()||t.user.status==='DEACTIVATED')fail('INVALID_TOKEN',tokenMessage);
   if(!passwordForUser(input.password,t.user.email,t.user.fullName))fail('WEAK_PASSWORD','Your password must not contain your name or email.');
   const required=t.user.mfaEnabled||t.user.role==='ADMIN'||(t.user.role==='QA_OFFICER'&&(await settings(tx)).qaMfa);
   if(required&&(!t.user.mfaSecret||!input.code||!authenticator.check(input.code,decrypt(t.user.mfaSecret))))fail('MFA_REQUIRED','Enter a valid authenticator code.');
   const u=await tx.user.update({where:{id:t.userId},data:{passwordHash:await argon2.hash(input.password,{type:argon2.argon2id}),status:'ACTIVE',failures:0,mfaEnabled:required}});
   await tx.oneTimeToken.update({where:{id:t.id},data:{usedAt:new Date()}});
   await tx.authSession.updateMany({where:{userId:u.id},data:{revokedAt:new Date()}});
   await audit(tx,u,path.toUpperCase(),u.id);
   return sessionResponse(tx,u,reply,input.transport);
  });
 });
 app.get('/api/v1/me',async req=>{const u=await db.user.findUniqueOrThrow({where:{id:req.actor.id}});return {user:publicUser(u),notifications:await db.notification.findMany({where:{userId:u.id},orderBy:{createdAt:'desc'},take:30})};});
}
