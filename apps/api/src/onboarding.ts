import {encrypt} from './core.js';
import {queueAccountMail} from './account-mail.js';
import {env} from './config.js';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import argon2 from 'argon2';
import {signupSchema,passwordForUser,reasonSchema} from '@agri/shared';
import {db,transaction,fail,audit,notify,system} from './core.js';

export async function onboardingRoutes(app:FastifyInstance){
 app.post('/api/v1/auth/signup',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async req=>{
  const v=signupSchema.parse(req.body);
  if(!passwordForUser(v.password,v.email,v.fullName))fail('WEAK_PASSWORD','Your password must not contain your name or email.');
  const passwordHash=await argon2.hash(v.password,{type:argon2.argon2id});
  return transaction(async tx=>{
   if(await tx.user.findUnique({where:{email:v.email}}))fail('EMAIL_EXISTS','An account already uses this email address. Sign in or reset your password.',409);
   // Applicants cannot select an existing tenant or grant themselves accreditation.
   const provider=v.role==='PROVIDER'?await tx.provider.create({data:{name:v.organisation,accreditationNumber:v.accreditationNumber!,province:v.province!,contact:v.email,status:'PENDING',validFrom:new Date(),validTo:new Date()}}):null;
   const u=await tx.user.create({data:{email:v.email,fullName:v.fullName,role:v.role,passwordHash,country:v.country,province:v.province,phone:v.phone?encrypt(v.phone):null,providerId:provider?.id,status:'PENDING',approvalStatus:'PENDING',requestedOrganisation:v.organisation}});
   await queueAccountMail(tx,u.email,'AgriProvider application received','Your account request has been received. Please wait for administrator approval before signing in at '+env.APP_URL+'.');
   await audit(tx,system,'ACCOUNT_REQUESTED',u.id,{role:u.role});
   await notify(tx,['ADMIN'],'A new '+u.role.toLowerCase().replaceAll('_',' ')+' account awaits approval.');
   return {status:'PENDING',message:'Awaiting Administrator Approval.'};
  });
 });
 app.get('/api/v1/admin/pending-accounts',async()=>db.user.findMany({where:{approvalStatus:'PENDING'},select:{id:true,fullName:true,email:true,role:true,createdAt:true,requestedOrganisation:true,provider:{select:{name:true,accreditationNumber:true,province:true}}},orderBy:{createdAt:'asc'},take:200}));
 app.post('/api/v1/admin/pending-accounts/:id',async req=>{
  const id=z.string().uuid().parse((req.params as any).id);
  const v=z.object({approve:z.boolean(),reason:reasonSchema.optional(),validFrom:z.string().datetime().optional(),validTo:z.string().datetime().optional()}).strict().parse(req.body);
  return transaction(async tx=>{
   const u=await tx.user.findUnique({where:{id}});
   if(!u||u.approvalStatus!=='PENDING'||u.status!=='PENDING')fail('NOT_PENDING','This account has already been reviewed.',409);
   if(!['PROVIDER','ASSESSOR','QA_OFFICER'].includes(u.role))fail('INVALID_ROLE','This role cannot use public account approval.',403);
   if(!v.approve&&!v.reason)fail('REASON_REQUIRED','Explain the rejection in at least 10 characters.');
   if(v.approve&&u.role==='PROVIDER'){
    if(!v.validFrom||!v.validTo||v.validFrom>=v.validTo||new Date(v.validTo)<=new Date())fail('ACCREDITATION_REQUIRED','Verify the accreditation and enter valid start and expiry dates.');
    await tx.provider.update({where:{id:u.providerId!},data:{status:'ACCREDITED',validFrom:v.validFrom,validTo:v.validTo}});
   }
   await tx.user.update({where:{id},data:{status:v.approve?'ACTIVE':'REJECTED',approvalStatus:v.approve?'APPROVED':'REJECTED',reviewedAt:new Date(),reviewedBy:req.actor.id,rejectionReason:v.approve?null:v.reason}});
   await tx.oneTimeToken.updateMany({where:{userId:id,usedAt:null},data:{revokedAt:new Date()}});
   await tx.authSession.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
   await queueAccountMail(tx,u.email,'AgriProvider account '+(v.approve?'approved':'requires attention'),v.approve?'Your account is approved. Sign in at '+env.APP_URL+'.':'Your application was not approved: '+v.reason);
   await audit(tx,req.actor,v.approve?'ACCOUNT_APPROVED':'ACCOUNT_REJECTED',id,{reason:v.reason??''});
   return {status:v.approve?'ACTIVE':'REJECTED'};
  });
 });
}
