import type {FastifyInstance} from 'fastify';
import {z} from 'zod';import argon2 from 'argon2';import {authenticator} from 'otplib';
import {db,transaction,encrypt,decrypt,hash,token,audit,fail} from './core.js';
export async function accountRoutes(app:FastifyInstance){
 app.post('/api/v1/me/push-token',async req=>{const {token:pushToken}=z.object({token:z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)}).strict().parse(req.body);return transaction(async tx=>{const u=await tx.user.findUniqueOrThrow({where:{id:req.actor.id}});await tx.user.update({where:{id:u.id},data:{pushTokens:[...new Set([...u.pushTokens,pushToken])]}});await audit(tx,req.actor,'PUSH_REGISTERED',u.id);return {ok:true};});});
 app.post('/api/v1/me/mfa/setup',async req=>{
  const {password}=z.object({password:z.string()}).strict().parse(req.body);
  return transaction(async tx=>{const u=await tx.user.findUniqueOrThrow({where:{id:req.actor.id}});
   if(!u.passwordHash||!await argon2.verify(u.passwordHash,password))fail('INVALID_PASSWORD','The password is incorrect.',403);
   if(u.mfaEnabled)fail('MFA_ENABLED','MFA is already enabled. You can regenerate recovery codes below.',409);
   const secret=authenticator.generateSecret();await tx.user.update({where:{id:u.id},data:{mfaSecret:encrypt(secret)}});
   await audit(tx,req.actor,'MFA_SETUP_STARTED',u.id);return {secret,otpAuthUrl:authenticator.keyuri(u.email,'AgriProvider',secret)};
  });
 });
 app.post('/api/v1/me/mfa/confirm',async req=>{
  const {code}=z.object({code:z.string().length(6)}).strict().parse(req.body);
  return transaction(async tx=>{const u=await tx.user.findUniqueOrThrow({where:{id:req.actor.id}});if(u.mfaEnabled||!u.mfaSecret||!authenticator.check(code,decrypt(u.mfaSecret)))fail('INVALID_CODE','Enter the current authenticator code.',400);
   const recoveryCodes=Array.from({length:8},()=>token().slice(0,16));await tx.user.update({where:{id:u.id},data:{mfaEnabled:true,recoveryHashes:recoveryCodes.map(hash)}});
   await audit(tx,req.actor,'MFA_ENABLED',u.id);return {recoveryCodes};
  });
 });
 app.post('/api/v1/me/mfa/recovery-codes',async req=>{
  const {password,code}=z.object({password:z.string(),code:z.string()}).strict().parse(req.body);
  return transaction(async tx=>{const u=await tx.user.findUniqueOrThrow({where:{id:req.actor.id}});
   if(!u.passwordHash||!await argon2.verify(u.passwordHash,password)||!u.mfaEnabled||!u.mfaSecret||!authenticator.check(code,decrypt(u.mfaSecret)))fail('VERIFICATION_FAILED','Check your password and current authenticator code.',403);
   const recoveryCodes=Array.from({length:8},()=>token().slice(0,16));await tx.user.update({where:{id:u.id},data:{recoveryHashes:recoveryCodes.map(hash)}});await audit(tx,req.actor,'RECOVERY_CODES_REGENERATED',u.id);return {recoveryCodes};
  });
 });
 app.post('/api/v1/me/notifications/:id/read',async req=>{const id=z.string().uuid().parse((req.params as any).id);await db.notification.updateMany({where:{id,userId:req.actor.id},data:{readAt:new Date()}});return {ok:true};});
}
