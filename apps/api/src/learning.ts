import {encrypt} from './core.js';
import {issueToken} from './auth.js';
import {confirmAccountCreated} from './account-mail.js';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import argon2 from 'argon2';
import {learnerAccountSchema,passwordForUser,programmeSchema,materialSchema,cohortSchema} from '@agri/shared';
import {db,transaction,fail,audit,cohortFor,assertProvider,mutate} from './core.js';

export async function learningRoutes(app:FastifyInstance){
 const uuid=z.string().uuid();
 app.post('/api/v1/provider/cohorts',async req=>{
  const input=cohortSchema.parse({...z.record(z.unknown()).parse(req.body),providerId:req.actor.providerId});
  return mutate(req.actor,undefined,input,async tx=>{
   await assertProvider(tx,input.providerId,true);const p=await tx.programme.findUnique({where:{id:input.programmeId}});if(!p)fail('NOT_FOUND','Programme not found.',404);
   if(input.sessionDates.length<p.requiredSessions||new Set(input.sessionDates).size!==input.sessionDates.length)fail('INVALID_SCHEDULE','Provide a unique date for every required session.');
   const {sessionDates,...values}=input;
   const c=await tx.cohort.create({data:values});
   await tx.trainingSession.createMany({data:sessionDates.map(date=>({cohortId:c.id,startsAt:new Date(date)}))});
   await tx.milestone.create({data:{cohortId:c.id,config:{requiredSessions:p.requiredSessions,attendanceThreshold:p.attendanceThreshold,version:p.version}}});
   await audit(tx,req.actor,'COHORT_CREATED',c.id);return c;
  });
 });
 app.patch('/api/v1/provider/cohorts/:id',async req=>{
  const p=z.object({capacity:z.number().int().min(1).optional(),status:z.enum(['ACTIVE','CLOSED']).optional(),endDate:z.string().datetime().optional()}).strict().parse(req.body);const id=uuid.parse((req.params as any).id);
  return mutate(req.actor,undefined,p,async tx=>{const scoped=await cohortFor(tx,req.actor,id);const c={...scoped,_count:{enrolments:scoped.enrolments.length}};await assertProvider(tx,c.providerId,true);if(p.capacity!==undefined&&p.capacity<c._count.enrolments)fail('CAPACITY_TOO_SMALL','Capacity cannot be below current enrolment.',409);if(c.milestones.some(m=>['READY_FOR_REVIEW','UNLOCKED'].includes(m.state))&&p.capacity!==undefined&&p.capacity!==c.capacity)fail('CONFIG_LOCKED','Capacity is locked during and after QA review.',409);if(p.endDate&&new Date(p.endDate)<c.endDate)fail('DATE_EXTENSION_ONLY','Active cohort dates may only be extended.');if(p.status==='ACTIVE')await assertProvider(tx,c.providerId,true);const r=await tx.cohort.update({where:{id},data:p});await audit(tx,req.actor,'COHORT_UPDATED',id);return r;});
 });

 app.post('/api/v1/provider/learners/:id/account',async req=>{
  const id=z.string().uuid().parse((req.params as any).id),v=learnerAccountSchema.parse(req.body);
  return transaction(async tx=>{
   const l=await tx.learner.findFirst({where:{id,anonymisedAt:null,enrolments:{some:{cohort:{providerId:req.actor.providerId!}}}},include:{account:{select:{id:true}}}});
   if(!l)fail('NOT_FOUND','Learner not found.',404);
   await assertProvider(tx,req.actor.providerId!,true);
   if(l.account)fail('ACCOUNT_EXISTS','This learner already has a portal account.',409);
   if(!passwordForUser(v.password,v.email,l.fullName))fail('WEAK_PASSWORD','The password must not contain the learner name or email.');
   const u=await tx.user.create({data:{email:v.email,fullName:l.fullName,role:'LEARNER',learnerId:l.id,country:v.country,province:v.province,phone:v.phone?encrypt(v.phone):null,passwordHash:await argon2.hash(v.password,{type:argon2.argon2id}),status:'ACTIVE'}});
   await issueToken(tx,u.id,'RESET','Welcome to your AgriProvider learner account');await confirmAccountCreated(tx,req.actor,u.email);
   await audit(tx,req.actor,'LEARNER_ACCOUNT_CREATED',u.id,{learnerId:l.id});
   return {email:u.email,status:u.status};
  });
 });
 app.get('/api/v1/learner/courses',async req=>{
  const u=await db.user.findUniqueOrThrow({where:{id:req.actor.id}});
  if(!u.learnerId)fail('NOT_FOUND','Learner profile not found.',404);
  const rows=await db.enrolment.findMany({where:{learnerId:u.learnerId},include:{cohort:{include:{programme:true,provider:{select:{name:true}},materials:{orderBy:{createdAt:'desc'}},sessions:{orderBy:{startsAt:'asc'},include:{attendance:{where:{learnerId:u.learnerId},select:{status:true}}}},assessments:{where:{learnerId:u.learnerId},select:{outcome:true,createdAt:true}},milestones:{select:{id:true,state:true,unlockedAt:true,certifications:{select:{id:true}}}}}}}});
  // Explicit projection: never return cohort enrolments, other learners, or evidence packs.
  return rows.map(({cohort:c})=>({id:c.id,name:c.programme.name,level:c.programme.level,provider:c.provider.name,status:c.status,attendanceThreshold:c.programme.attendanceThreshold,materials:c.materials.map(m=>({id:m.id,title:m.title,content:m.content,url:m.url})),lessons:c.sessions.map(s=>({id:s.id,title:s.title,startsAt:s.startsAt,attendance:s.attendance[0]?.status??'UNMARKED'})),result:c.assessments[0]?.outcome??'PENDING',certificates:c.assessments[0]?.outcome==='PASS'?c.milestones.filter(m=>m.state==='UNLOCKED'&&m.certifications.length).map(m=>({id:m.certifications[0].id,issuedAt:m.unlockedAt,learnerName:u.fullName,programme:c.programme.name,level:c.programme.level,provider:c.provider.name})):[]}));
 });
 app.post('/api/v1/provider/programmes',async req=>{
  const v=z.object({programme:programmeSchema,cohort:z.object({code:z.string().trim().min(2),capacity:z.number().int().min(1).max(1000),startDate:z.string().datetime(),endDate:z.string().datetime(),sessionDates:z.array(z.string().datetime()).min(1)}).strict()}).strict().parse(req.body);
  return transaction(async tx=>{
   await assertProvider(tx,req.actor.providerId!,true);
   const c=v.cohort,p=v.programme;
   if(c.startDate>=c.endDate||c.sessionDates.length<p.requiredSessions||new Set(c.sessionDates).size!==c.sessionDates.length||c.sessionDates.some(d=>d<c.startDate||d>c.endDate))fail('INVALID_SCHEDULE','Schedule all required sessions inside the programme dates.');
   const programme=await tx.programme.create({data:p});
   const {sessionDates,...values}=c;
   const cohort=await tx.cohort.create({data:{...values,providerId:req.actor.providerId!,programmeId:programme.id}});
   await tx.trainingSession.createMany({data:sessionDates.map((d,i)=>({cohortId:cohort.id,startsAt:d,title:'Module '+(i+1)}))});
   await tx.milestone.create({data:{cohortId:cohort.id,config:{requiredSessions:p.requiredSessions,attendanceThreshold:p.attendanceThreshold,version:programme.version}}});
   await audit(tx,req.actor,'PROGRAMME_AND_COHORT_CREATED',cohort.id);return {id:cohort.id};
  });
 });
 app.post('/api/v1/provider/cohorts/:id/materials',async req=>{
  const id=z.string().uuid().parse((req.params as any).id),v=materialSchema.parse(req.body);
  return transaction(async tx=>{await cohortFor(tx,req.actor,id,true);const m=await tx.learningMaterial.create({data:{...v,cohortId:id}});await audit(tx,req.actor,'LEARNING_MATERIAL_CREATED',m.id);return {id:m.id};});
 });
 app.post('/api/v1/provider/cohorts/:id/sessions',async req=>{
  const id=z.string().uuid().parse((req.params as any).id),v=z.object({title:z.string().trim().min(2).max(120),startsAt:z.string().datetime()}).strict().parse(req.body);
  return transaction(async tx=>{
   const c=await cohortFor(tx,req.actor,id,true);
   if(c.assessments.length||c.milestones.some(m=>m.state!=='LOCKED'||m.attendanceCondition==='VERIFIED'))fail('SCHEDULE_LOCKED','Ask QA to reopen this cohort before changing its schedule.',409);
   if(new Date(v.startsAt)<c.startDate||new Date(v.startsAt)>c.endDate||new Date(v.startsAt)<new Date())fail('INVALID_DATE','Schedule upcoming lessons within the cohort dates.');
   const s=await tx.trainingSession.create({data:{...v,cohortId:id}});await audit(tx,req.actor,'LESSON_SCHEDULED',s.id);return {id:s.id};
  });
 });
}
