import {encrypt} from './core.js';
import {confirmAccountCreated} from './account-mail.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { providerSchema,programmeSchema,inviteSchema,reasonSchema,settingsSchema } from '@agri/shared';
import { db,fail,mutate,audit,settings,token,hash,notify,assertProvider,type Tx,type Actor } from './core.js';
import { issueToken } from './auth.js';
const uuid=z.string().uuid();
export async function invite(tx:Tx,actor:Actor,raw:z.input<typeof inviteSchema>){
 const input=inviteSchema.parse(raw);
 if(await tx.user.findUnique({where:{email:input.email}}))fail('EMAIL_EXISTS','An account already uses this email address.',409);
 if(input.role==='PROVIDER')await assertProvider(tx,input.providerId!,true);
 for(const id of input.cohortIds??[])if(!await tx.cohort.findUnique({where:{id}}))fail('INVALID_SCOPE','The selected cohort does not exist.');
 const u=await tx.user.create({data:{email:input.email,fullName:input.fullName,role:input.role,country:input.country,province:input.province,phone:input.phone?encrypt(input.phone):null,providerId:input.role==='PROVIDER'?input.providerId:null}});
 for(const cohortId of input.cohortIds??[])await tx.assignment.create({data:{cohortId,userId:u.id}});
 await issueToken(tx,u.id,'INVITE');await confirmAccountCreated(tx,actor,u.email);await audit(tx,actor,'USER_INVITED',u.id,{role:u.role});return {id:u.id,email:u.email,role:u.role,status:u.status};
}
async function applyAction(tx:Tx,actor:Actor,action:string,p:any):Promise<any>{
 if(action==='INVITE_ADMIN')return invite(tx,actor,inviteSchema.parse(p));
 if(action==='SETTINGS'){const value=settingsSchema.parse(p);const last=await tx.systemSetting.findFirst({orderBy:{version:'desc'}});return tx.systemSetting.create({data:{version:(last?.version??0)+1,value}});}
 if(action==='DEACTIVATE_ADMIN')return changeUser(tx,actor,p.id,'deactivate');
 if(action==='RESET_ADMIN_MFA'){await tx.authSession.updateMany({where:{userId:p.id},data:{revokedAt:new Date()}});await tx.user.update({where:{id:p.id},data:{mfaEnabled:false,mfaSecret:null}});await issueToken(tx,p.id,'RESET');return {ok:true};}
 if(action==='PROVIDER_STATUS'){
  const provider=await assertProvider(tx,p.id);
  if(provider.status==='REVOKED')fail('FINAL_STATUS','Revoked accreditation cannot be restored.',409);
  if(p.status==='REVOKED'&&await tx.milestone.count({where:{cohort:{providerId:p.id},state:'READY_FOR_REVIEW'}}))fail('QA_ACK_REQUIRED','QA must resolve pending milestone reviews before revocation.',409);
  if(p.status==='ACCREDITED'&&provider.validTo<new Date())fail('ACCREDITATION_EXPIRED','Update the accreditation expiry before reinstatement.',409);
  const result=await tx.provider.update({where:{id:p.id},data:{status:p.status,reason:p.reason}});
  const milestones=await tx.milestone.findMany({where:{cohort:{providerId:p.id},state:{not:'UNLOCKED'}}});
  for(const m of milestones){if(p.status==='ACCREDITED'&&m.state==='FROZEN')await tx.milestone.update({where:{id:m.id},data:{state:m.previousState??'LOCKED',previousState:null}});else if(p.status!=='ACCREDITED'&&m.state!=='FROZEN')await tx.milestone.update({where:{id:m.id},data:{state:'FROZEN',previousState:m.state}});}
  await notify(tx,['PROVIDER'],'Provider accreditation is now '+p.status,p.id);return result;
 }
 if(action==='REVOKE_KEY'){await tx.apiKey.update({where:{id:p.id},data:{revokedAt:new Date()}});return {ok:true};}
 fail('INVALID_ACTION','Unknown administrative action.');
}
async function protectedAction(tx:Tx,actor:Actor,action:string,p:Prisma.InputJsonValue){
 const count=await tx.user.count({where:{role:'ADMIN',status:'ACTIVE'}});
 if(count>=2){const a=await tx.approvalRequest.create({data:{requesterId:actor.id,action,payload:p,expiresAt:new Date(Date.now()+48*3600000)}});await audit(tx,actor,'APPROVAL_REQUESTED',a.id,{action});return {pending:true,approvalId:a.id};}
 const r=await applyAction(tx,actor,action,p);await audit(tx,actor,action,String((p as any).id??'settings'),{singleAdmin:true});return r;
}
async function changeUser(tx:Tx,actor:Actor,id:string,action:string){
 if(id===actor.id)fail('SELF_CHANGE','You cannot perform this administrative action on your own account.',403);
 const u=await tx.user.findUnique({where:{id}});if(!u)fail('NOT_FOUND','User not found.',404);
 if(u.approvalStatus!=='APPROVED')fail('APPROVAL_REQUIRED','Review this account in Pending accounts before performing account actions.',409);
 if(action==='deactivate'){
  if(u.role==='ADMIN'&&u.status==='ACTIVE'&&await tx.user.count({where:{role:'ADMIN',status:'ACTIVE'}})<=1)fail('LAST_ADMIN','The last active administrator cannot be deactivated.',409);
  await tx.user.update({where:{id},data:{status:'DEACTIVATED'}});
 }else if(action==='reactivate'){
  if(u.providerId)await assertProvider(tx,u.providerId,true);
  if(!u.passwordHash)fail('INVITE_REQUIRED','Resend an invitation for an account that has not been activated.');
  await tx.user.update({where:{id},data:{status:'ACTIVE',failures:0}});
 }else if(action==='unlock')await tx.user.update({where:{id},data:{status:u.status==='LOCKED'?'ACTIVE':u.status,failures:0,lockedUntil:null}});
 else if(action==='reset-password')await issueToken(tx,id,'RESET');
 else if(action==='resend-invite'){if(u.status!=='PENDING')fail('NOT_PENDING','Only pending invitations can be resent.');await issueToken(tx,id,'INVITE');}
 else if(action==='revoke-invite')await tx.oneTimeToken.updateMany({where:{userId:id,kind:'INVITE'},data:{revokedAt:new Date()}});
 else if(action==='reset-mfa'){await tx.user.update({where:{id},data:{mfaSecret:null,mfaEnabled:false}});await issueToken(tx,id,'RESET');}
 await tx.authSession.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
 await audit(tx,actor,'USER_'+action.toUpperCase(),id);return {ok:true};
}
export async function adminRoutes(app:FastifyInstance){
 app.get('/api/v1/admin/dashboard',async()=>({users:await db.user.groupBy({by:['role','status'],_count:true}),providers:await db.provider.groupBy({by:['status'],_count:true}),pendingAccounts:await db.user.count({where:{approvalStatus:'PENDING'}}),pendingApprovals:await db.approvalRequest.count({where:{status:'PENDING',expiresAt:{gt:new Date()}}}),failedEvents:await db.outboxEvent.count({where:{status:'FAILED'}}),expiringProviders:await db.provider.findMany({where:{validTo:{lte:new Date(Date.now()+60*86400000)}}}),recent:await db.auditLog.findMany({orderBy:{createdAt:'desc'},take:15})}));
 app.get('/api/v1/admin/users',async()=>db.user.findMany({select:{id:true,email:true,fullName:true,role:true,status:true,providerId:true,mfaEnabled:true,createdAt:true},orderBy:{createdAt:'desc'},take:200}));
 app.post('/api/v1/admin/users',async req=>{const input=inviteSchema.parse(req.body);return mutate(req.actor,undefined,input,tx=>input.role==='ADMIN'?protectedAction(tx,req.actor,'INVITE_ADMIN',input):invite(tx,req.actor,input));});
 app.post('/api/v1/admin/users/:id/:action',async req=>{
  const p=z.object({id:uuid,action:z.enum(['deactivate','reactivate','unlock','force-logout','reset-password','resend-invite','revoke-invite','reset-mfa'])}).parse(req.params);
  return mutate(req.actor,undefined,p,async tx=>{if(p.id===req.actor.id)fail('SELF_CHANGE','You cannot perform this administrative action on your own account.',403);const u=await tx.user.findUnique({where:{id:p.id}});if(!u)fail('NOT_FOUND','User not found.',404);if(u.role==='ADMIN'&&['deactivate','reset-mfa'].includes(p.action))return protectedAction(tx,req.actor,p.action==='deactivate'?'DEACTIVATE_ADMIN':'RESET_ADMIN_MFA',{id:p.id});return changeUser(tx,req.actor,p.id,p.action);});
 });
 app.get('/api/v1/admin/providers',async()=>db.provider.findMany({orderBy:{name:'asc'},take:200}));
 app.post('/api/v1/admin/providers',async req=>{const p=providerSchema.parse(req.body);return mutate(req.actor,undefined,p,async tx=>{const v=await tx.provider.create({data:p});await audit(tx,req.actor,'PROVIDER_CREATED',v.id);return v;});});
 app.patch('/api/v1/admin/providers/:id',async req=>{const p=providerSchema.parse(req.body);const id=uuid.parse((req.params as any).id);return mutate(req.actor,undefined,p,async tx=>{const v=await tx.provider.update({where:{id},data:p});await audit(tx,req.actor,'PROVIDER_UPDATED',id);return v;});});
 app.post('/api/v1/admin/providers/:id/status',async req=>{const p=z.object({status:z.enum(['ACCREDITED','SUSPENDED','REVOKED']),reason:reasonSchema}).strict().parse(req.body);const id=uuid.parse((req.params as any).id);return mutate(req.actor,undefined,p,tx=>protectedAction(tx,req.actor,'PROVIDER_STATUS',{id,...p}));});
 app.get('/api/v1/admin/programmes',async()=>db.programme.findMany({orderBy:{name:'asc'},take:200}));
 app.post('/api/v1/admin/programmes',async req=>{const p=programmeSchema.parse(req.body);return mutate(req.actor,undefined,p,async tx=>{const v=await tx.programme.create({data:p});await audit(tx,req.actor,'PROGRAMME_CREATED',v.id);return v;});});
 app.patch('/api/v1/admin/programmes/:id',async req=>{const p=programmeSchema.parse(req.body);const id=uuid.parse((req.params as any).id);return mutate(req.actor,undefined,p,async tx=>{const v=await tx.programme.update({where:{id},data:{...p,version:{increment:1}}});await audit(tx,req.actor,'PROGRAMME_VERSION_CREATED',id);return v;});});
 app.get('/api/v1/admin/cohorts',async()=>db.cohort.findMany({include:{provider:true,programme:true,_count:{select:{enrolments:true}}},take:200}));
 app.get('/api/v1/admin/assignments',async()=>db.assignment.findMany({include:{user:{select:{fullName:true,email:true}},cohort:{include:{programme:true}}},take:200}));
 app.post('/api/v1/admin/assignments',async req=>{
  const p=z.object({userId:uuid,cohortId:uuid,active:z.boolean()}).strict().parse(req.body);
  return mutate(req.actor,undefined,p,async tx=>{const u=await tx.user.findUnique({where:{id:p.userId}});if(!u||u.role!=='ASSESSOR')fail('INVALID_ASSESSOR','Choose an assessor account.');if(!p.active&&await tx.assessment.count({where:{cohortId:p.cohortId,assessorId:p.userId}}))fail('QA_ACK_REQUIRED','Retain this assignment until QA has completed the batch.',409);const a=await tx.assignment.upsert({where:{userId_cohortId:{userId:p.userId,cohortId:p.cohortId}},create:p,update:{active:p.active}});await audit(tx,req.actor,'ASSIGNMENT_UPDATED',a.id);await notify(tx,['ASSESSOR'],'Assessor assignments have changed.');return a;});
 });
 app.get('/api/v1/admin/settings',async()=>settings());
 app.post('/api/v1/admin/settings',async req=>{const p=settingsSchema.parse(req.body);return mutate(req.actor,undefined,p,tx=>protectedAction(tx,req.actor,'SETTINGS',p));});
 app.get('/api/v1/admin/approvals',async()=>db.approvalRequest.findMany({orderBy:{createdAt:'desc'},take:100}));
 app.post('/api/v1/admin/approvals/:id',async req=>{
  const p=z.object({approve:z.boolean()}).strict().parse(req.body),id=uuid.parse((req.params as any).id);
  return mutate(req.actor,undefined,p,async tx=>{
   const a=await tx.approvalRequest.findUnique({where:{id}});if(!a||a.status!=='PENDING'||a.expiresAt<new Date())fail('APPROVAL_EXPIRED','This request is no longer pending.',409);
   if(a.requesterId===req.actor.id)fail('SELF_APPROVAL','A different administrator must approve this request.',403);
   if(p.approve){if(a.action==='RECOMMEND_SUSPENSION')await protectedAction(tx,req.actor,'PROVIDER_STATUS',{id:(a.payload as any).providerId,status:'SUSPENDED',reason:(a.payload as any).reason});else await applyAction(tx,req.actor,a.action,a.payload);}
   await tx.approvalRequest.update({where:{id},data:{approverId:req.actor.id,status:p.approve?'APPROVED':'REJECTED'}});await audit(tx,req.actor,'APPROVAL_DECIDED',id,{approved:p.approve});return {ok:true};
  });
 });
 app.get('/api/v1/admin/audit-log',async req=>{const q=z.object({page:z.coerce.number().int().min(1).default(1),action:z.string().optional(),actorId:z.string().optional()}).parse(req.query);return {items:await db.auditLog.findMany({where:{...(q.action?{action:{contains:q.action}}:{}),...(q.actorId?{actorId:q.actorId}:{})},orderBy:{createdAt:'desc'},skip:(q.page-1)*50,take:50}),page:q.page};});
 app.get('/api/v1/admin/audit-log/export',async(req,reply)=>{await audit(db,req.actor,'AUDIT_EXPORTED','audit-log');const rows=await db.auditLog.findMany({orderBy:{createdAt:'desc'},take:10000});const csv=(v:string)=>'"'+v.replace(/"/g,'""').replace(/^[=+@-]/,"'")+'"';return reply.header('content-type','text/csv').header('content-disposition','attachment; filename="audit-log.csv"').send('Time,Actor,Role,Action,Entity\n'+rows.map(r=>[r.createdAt.toISOString(),r.actorId,r.role,r.action,r.entityId].map(csv).join(',')).join('\n'));});
 app.get('/api/v1/admin/integrations',async()=>({keys:await db.apiKey.findMany({select:{id:true,name:true,scopes:true,expiresAt:true,revokedAt:true}}),events:await db.outboxEvent.findMany({select:{id:true,type:true,status:true,attempts:true,createdAt:true,lastError:true},orderBy:{createdAt:'desc'},take:100})}));
 app.post('/api/v1/admin/integrations',async req=>{
  const p=z.object({name:z.string().min(2),scopes:z.array(z.enum(['programmes:read','findings:write','certifications:read'])).min(1),expiresAt:z.string().datetime()}).strict().parse(req.body);
  return mutate(req.actor,undefined,p,async tx=>{if(new Date(p.expiresAt)<=new Date())fail('INVALID_EXPIRY','Choose a future expiry date.');const raw=token();const k=await tx.apiKey.create({data:{...p,hash:hash(raw)}});await audit(tx,req.actor,'API_KEY_CREATED',k.id);return {id:k.id,key:raw};});
 });
 app.post('/api/v1/admin/integrations/:id/revoke',async req=>{const id=uuid.parse((req.params as any).id);return mutate(req.actor,undefined,{id},tx=>protectedAction(tx,req.actor,'REVOKE_KEY',{id}));});
 app.post('/api/v1/admin/outbox/:id/retry',async req=>mutate(req.actor,undefined,req.params,async tx=>{const id=uuid.parse((req.params as any).id);await tx.outboxEvent.update({where:{id},data:{status:'PENDING',nextAttemptAt:new Date()}});await audit(tx,req.actor,'OUTBOX_RETRIED',id);return {ok:true};}));
 app.post('/api/v1/admin/support-access',async req=>{
  const p=z.object({entityId:uuid,reason:reasonSchema}).strict().parse(req.body);
  return mutate(req.actor,undefined,p,async tx=>{if(!await tx.evidence.findUnique({where:{id:p.entityId}})&&!await tx.learner.findUnique({where:{id:p.entityId}}))fail('NOT_FOUND','Record not found.',404);const g=await tx.supportGrant.create({data:{...p,userId:req.actor.id,expiresAt:new Date(Date.now()+30*60000)}});await audit(tx,req.actor,'SUPPORT_ACCESS_GRANTED',p.entityId,{reason:p.reason});await notify(tx,['QA_OFFICER'],'Time-limited support access granted to '+req.actor.fullName);return g;});
 });
 app.get('/api/v1/admin/data-requests',async()=>db.dataRequest.findMany({orderBy:{createdAt:'desc'},take:100}));
 app.post('/api/v1/admin/data-requests',async req=>{
  const p=z.object({learnerId:uuid,type:z.enum(['ACCESS','CORRECTION','ANONYMISE']),reason:reasonSchema}).strict().parse(req.body);
  return mutate(req.actor,undefined,p,async tx=>{if(!await tx.learner.findUnique({where:{id:p.learnerId}}))fail('NOT_FOUND','Learner not found.',404);const r=await tx.dataRequest.create({data:p});await audit(tx,req.actor,'DATA_REQUEST_CREATED',r.id);return r;});
 });
 app.post('/api/v1/admin/data-requests/:id/process',async req=>mutate(req.actor,undefined,req.params,async tx=>{
  const id=uuid.parse((req.params as any).id),r=await tx.dataRequest.findUniqueOrThrow({where:{id}});
  if(r.type!=='ANONYMISE')fail('MANUAL_REVIEW','Access and correction requests require a scoped support review.');
  const l=await tx.learner.findUniqueOrThrow({where:{id:r.learnerId},include:{enrolments:{include:{cohort:{include:{milestones:true}}}}}});
  const cutoff=new Date(Date.now()-(await settings(tx)).retentionDays*86400000);
  if(l.createdAt>cutoff||l.enrolments.some(e=>e.cohort.milestones.some(m=>m.state==='READY_FOR_REVIEW'||m.updatedAt>cutoff)))fail('RETENTION_HOLD','This record remains within the retention or review window.',409);
  await tx.learner.update({where:{id:l.id},data:{fullName:'Anonymised learner',nationalIdEncrypted:'',phoneEncrypted:'',idLastFour:'0000',anonymisedAt:new Date()}});
  await tx.dataRequest.update({where:{id},data:{status:'COMPLETED'}});await audit(tx,req.actor,'LEARNER_ANONYMISED',l.id);return {ok:true};
 }));
 app.get('/api/v1/admin/health',async()=>({apiVersion:'1.0.0',database:!!(await db.$queryRaw`SELECT 1`),jobs:await db.jobHeartbeat.findMany(),queueDepth:await db.outboxEvent.count({where:{status:'PENDING'}})}));
}
