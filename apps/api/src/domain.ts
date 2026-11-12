import {env} from './config.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { learnerSchema,attendanceSchema,assessmentSchema,evidenceTypes,reasonSchema } from '@agri/shared';
import { db,fail,mutate,cohortFor,audit,hash,encrypt,checksum,notify,settings,type Tx } from './core.js';
import { storage,detectMime,scan,reportPdf } from './storage.js';
const uuid=z.string().uuid();
const params=(req:any)=>uuid.parse(req.params.id);
export function safeCohort(c:any){return {...c,assignments:undefined,enrolments:c.enrolments.map((e:any)=>({id:e.id,learnerId:e.learnerId,learner:{id:e.learner.id,fullName:e.learner.fullName,maskedId:'•••••••••'+e.learner.idLastFour,accountEmail:e.learner.account?.email??null,consentAt:e.learner.consentAt,complete:c.milestones.some((m:any)=>m.evidence.some((v:any)=>v.type==='CONSENT_FORMS'&&v.learnerIds.includes(e.learnerId)))}}))};}
export function learnerPackStatus(c:any,m:any,learnerId:string){
 const files=[...m.evidence].sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
 const assessment=c.assessments.find((a:any)=>a.learnerId===learnerId);
 return evidenceTypes.map(type=>{
  const scoped=files.find((e:any)=>e.type===type&&e.scopeLearnerId===learnerId);
  const e=scoped??files.find((e:any)=>e.type===type&&!e.scopeLearnerId&&(e.learnerIds.includes(learnerId)||type==='ATTENDANCE_LOG'));
  const notRequired=type==='CERTIFICATES'&&assessment?.outcome==='FAIL';
  let ok=!!e&&e.status!=='REJECTED';
  if(type==='ATTENDANCE_LOG')ok=ok&&c.sessions.every((s:any)=>e.sessionIds.includes(s.id));
  if(type==='CERTIFICATES')ok=ok&&assessment?.outcome==='PASS'&&e.signed&&!!e.signerName&&!!e.signedAt;
  if(type==='ASSESSOR_REPORT')ok=ok&&!!assessment;
  return {type,status:notRequired||ok?'Uploaded':e&&type==='CERTIFICATES'&&!e.signed?'Missing signature':e?'Needs attention':'Missing',evidenceId:e?.id,fileName:e?.fileName,notRequired};
 });
}
export function packStatus(c:any,m:any){
 const packs=c.enrolments.map((e:any)=>learnerPackStatus(c,m,e.learnerId));
 return evidenceTypes.map(type=>{const items=packs.map((p:any)=>p.find((e:any)=>e.type===type));const first=items.find((i:any)=>i.evidenceId);return {type,status:items.length&&items.every((i:any)=>i.status==='Uploaded')?'Uploaded':items.some((i:any)=>i.status==='Missing signature')?'Missing signature':items.some((i:any)=>i.evidenceId)?'Needs attention':'Missing',evidenceId:first?.evidenceId,fileName:first?.fileName};});
}
export function conditions(c:any,m:any){
 const config=m.config as any;const enrolled=c.enrolments.length;
 const attendance=c.sessions.length>=config.requiredSessions&&c.sessions.every((s:any)=>s.attendance.length===enrolled&&s.startsAt<=new Date())&&c.enrolments.every((e:any)=>100*c.sessions.filter((s:any)=>s.attendance.some((a:any)=>a.learnerId===e.learnerId&&a.status!=='ABSENT')).length/c.sessions.length>=config.attendanceThreshold);
 const pack=packStatus(c,m);
 return {enrolment:enrolled===c.capacity&&enrolled>0&&pack.filter(e=>['ENROLMENT_LIST','ID_DOCUMENTS','CONSENT_FORMS'].includes(e.type)).every(e=>e.status==='Uploaded'),attendance:attendance&&pack.find(e=>e.type==='ATTENDANCE_LOG')?.status==='Uploaded',certification:(!c.learnerPacks?.length||c.enrolments.every((e:any)=>c.learnerPacks.some((p:any)=>p.learnerId===e.learnerId&&p.status==='VERIFIED')))&&pack.find(e=>e.type==='CERTIFICATES')?.status==='Uploaded'&&pack.find(e=>e.type==='ASSESSOR_REPORT')?.status==='Uploaded'&&c.moderation[0]?.status==='SIGNED_OFF'};
}
async function editable(tx:Tx,c:any){if(c.milestones.some((m:any)=>['UNLOCKED','FROZEN'].includes(m.state)))fail('MILESTONE_LOCKED','This milestone is locked. Ask QA to review it.',409);}
export async function resetReview(tx:Tx,c:any){for(const m of c.milestones)await tx.milestone.update({where:{id:m.id},data:{state:'LOCKED',enrolmentCondition:'PENDING',attendanceCondition:'PENDING',certificationCondition:'PENDING',submittedAt:null}});if(c.moderation.length)await tx.moderationReview.create({data:{cohortId:c.id,moderatorId:c.moderation[0].moderatorId,status:'STALE',reason:'Evidence or records changed; review again.'}});}
export async function domainRoutes(app:FastifyInstance){
 for(const role of ['provider','assessor'])app.get('/api/v1/'+role+'/cohorts',async req=>{
  const ids=await db.cohort.findMany({where:role==='provider'?{providerId:req.actor.providerId!}:{assignments:{some:{userId:req.actor.id,active:true}}},select:{id:true},take:100});
  return Promise.all(ids.map(async x=>{const c=await cohortFor(db,req.actor,x.id);return safeCohort(c);}));
 });
 for(const role of ['provider','assessor','qa'])app.get('/api/v1/'+role+'/cohorts/:id',async req=>{const c=await cohortFor(db,req.actor,params(req));return {...safeCohort(c),packs:c.milestones.map(m=>({milestoneId:m.id,items:packStatus(c,m),conditions:conditions(c,m)}))};});
 app.post('/api/v1/provider/learners',async req=>{
  const input=learnerSchema.parse(req.body);
  return mutate(req.actor,input.clientOpId,input,async tx=>{
   const c=await cohortFor(tx,req.actor,input.cohortId,true);await editable(tx,c);
   if(c.enrolments.length>=c.capacity)fail('CAPACITY_REACHED','This cohort is full. Create or select another cohort in My programmes.',409);
   if(await tx.enrolment.findUnique({where:{programmeId_nationalIdHash:{programmeId:c.programmeId,nationalIdHash:hash(input.nationalId)}}}))fail('DUPLICATE_LEARNER','This learner is already enrolled in this programme.',409);
   const l=await tx.learner.create({data:{fullName:input.fullName,nationalIdEncrypted:encrypt(input.nationalId),nationalIdHash:hash(input.nationalId),idLastFour:input.nationalId.slice(-4),phoneEncrypted:encrypt(input.phone),consentAt:new Date(),consentVersion:'2026-01'}});
   await tx.enrolment.create({data:{cohortId:c.id,programmeId:c.programmeId,learnerId:l.id,nationalIdHash:l.nationalIdHash}});
   await resetReview(tx,c);await audit(tx,req.actor,'LEARNER_REGISTERED',l.id,{cohortId:c.id},input.clientOpId);
   await notify(tx,['ASSESSOR'],'A learner was registered in '+c.code,undefined,c.id);
   return {id:l.id,fullName:l.fullName,maskedId:'•••••••••'+l.idLastFour};
  });
 });
 app.post('/api/v1/provider/attendance',async req=>{
  const input=attendanceSchema.parse(req.body);
  return mutate(req.actor,input.clientOpId,input,async tx=>{
   const s=await tx.trainingSession.findUnique({where:{id:input.sessionId}});if(!s)fail('NOT_FOUND','Session not found.',404);
   const c=await cohortFor(tx,req.actor,s.cohortId,true);await editable(tx,c);
   if(c.milestones.some(m=>m.attendanceCondition==='VERIFIED'))fail('ATTENDANCE_LOCKED','QA must reopen attendance before it can change.',409);
   if(s.startsAt>new Date())fail('FUTURE_SESSION','Attendance cannot be recorded before the session starts.');
   const ids=c.enrolments.map(e=>e.learnerId),map=new Map(input.records.map(r=>[r.learnerId,r.status]));
   if(map.size!==input.records.length||[...map.keys()].some(id=>!ids.includes(id)))fail('INVALID_LEARNERS','Only this cohort’s enrolled learners can be marked.');
   if(!input.markRemainingAbsent&&map.size!==ids.length)fail('UNMARKED_LEARNERS','Mark every learner, or confirm that remaining learners are absent.');
   for(const id of ids)await tx.attendance.upsert({where:{sessionId_learnerId:{sessionId:s.id,learnerId:id}},create:{sessionId:s.id,learnerId:id,status:map.get(id)??'ABSENT',recordedBy:req.actor.id},update:{status:map.get(id)??'ABSENT',recordedBy:req.actor.id}});
   await resetReview(tx,c);await audit(tx,req.actor,'ATTENDANCE_RECORDED',s.id,{count:ids.length},input.clientOpId);
   await notify(tx,['ASSESSOR'],'Attendance is ready for '+c.code,undefined,c.id);return {ok:true,count:ids.length};
  });
 });
 app.post('/api/v1/provider/evidence/:id',async req=>{
  const milestoneId=params(req);const part=await req.file({limits:{fileSize:(await settings()).maxFileMb*1024*1024}});
  if(!part)fail('FILE_REQUIRED','Choose a PDF, JPG or PNG file.');
  const data=await part.toBuffer();if(part.file.truncated)fail('FILE_TOO_LARGE','This file exceeds the upload limit.',413);
  let mime=detectMime(data);
  const fields=part.fields as any;let raw:unknown;try{raw=JSON.parse(String(fields.metadata?.value??'{}'));}catch{fail('INVALID_METADATA','The upload metadata must be valid JSON.');}
  const input=z.object({type:z.enum(evidenceTypes),learnerIds:z.array(uuid),sessionIds:z.array(uuid),signed:z.boolean(),signerName:z.string().optional(),signedAt:z.string().datetime().optional(),clientOpId:uuid}).strict().parse(raw);
  if(!mime&&!(input.type==='CERTIFICATES'&&env.NODE_ENV!=='production'))fail('INVALID_FILE','Only genuine PDF, JPG and PNG files are accepted.');
  mime=mime??'application/octet-stream';
  if(input.type==='ASSESSOR_REPORT')fail('FORBIDDEN','Assessor reports attach automatically after grading.',403);
  if(input.signed&&(!input.signerName?.trim()||!input.signedAt||new Date(input.signedAt)>new Date()))fail('SIGNATURE_REQUIRED','A signed certificate requires a signer name and a valid signing date.');
  const scanStatus=await scan(data),sum=checksum(data);
  return mutate(req.actor,input.clientOpId,{...input,checksum:sum},async tx=>{
   const m=await tx.milestone.findUnique({where:{id:milestoneId}});if(!m)fail('NOT_FOUND','Milestone not found.',404);
   const c=await cohortFor(tx,req.actor,m.cohortId,true);await editable(tx,c);
   if(!c.enrolments.length||c.assessments.length!==c.enrolments.length)fail('ASSESSMENT_REQUIRED','Complete attendance and assessment before uploading milestone evidence.',409);
   if(input.learnerIds.some(id=>!c.enrolments.some(e=>e.learnerId===id))||input.sessionIds.some(id=>!c.sessions.some(s=>s.id===id)))fail('INVALID_COVERAGE','Evidence must refer only to this cohort.');
   if(input.type==='CERTIFICATES'&&input.learnerIds.some(id=>!c.assessments.some(a=>a.learnerId===id&&a.outcome==='PASS')))fail('INVALID_CERTIFICATE','Certificates can only cover learners who passed.');
   const key=await storage.put(data,mime);
   const values={storageKey:key,fileName:part.filename.slice(0,200),mime,size:data.length,checksum:sum,ownerId:req.actor.id,learnerIds:input.learnerIds,sessionIds:input.sessionIds,signed:input.signed,signerName:input.signerName??null,signedAt:input.signedAt?new Date(input.signedAt):null,scanStatus,status:'UPLOADED'};
   const e=await tx.evidence.create({data:{milestoneId,type:input.type,...values}});
   await resetReview(tx,c);await audit(tx,req.actor,'EVIDENCE_UPLOADED',e.id,{type:input.type,checksum:sum},input.clientOpId);return {id:e.id};
  });
 });
 app.post('/api/v1/provider/milestones/:id/submit',async req=>mutate(req.actor,undefined,req.body,async tx=>{
  const m=await tx.milestone.findUnique({where:{id:params(req)}});if(!m)fail('NOT_FOUND','Milestone not found.',404);
  const c=await cohortFor(tx,req.actor,m.cohortId,true);await editable(tx,c);
  const pack=packStatus(c,c.milestones.find(x=>x.id===m.id));if(pack.some(x=>x.status!=='Uploaded'))fail('INCOMPLETE_EVIDENCE','Complete all six evidence types before submitting for QA.',409);
  if(c.moderation[0]?.status!=='SIGNED_OFF')fail('MODERATION_REQUIRED','An independent assessor must sign off the evidence.',409);
  await tx.milestone.update({where:{id:m.id},data:{state:'READY_FOR_REVIEW',submittedAt:new Date(),rejectionReason:null}});
  await audit(tx,req.actor,'MILESTONE_SUBMITTED',m.id);await notify(tx,['QA_OFFICER'],'Evidence is ready for review: '+c.provider.name);return {ok:true};
 }));
 app.post('/api/v1/assessor/assessments',async req=>{
  const input=assessmentSchema.parse(req.body);
  return mutate(req.actor,input.clientOpId,input,async tx=>{
   const c=await cohortFor(tx,req.actor,input.cohortId,true);await editable(tx,c);
   if(c.assessments.length)fail('ASSESSMENT_IMMUTABLE','Results are already submitted. Request a moderation reopen.',409);
   const ids=c.enrolments.map(e=>e.learnerId),map=new Map(input.grades.map(g=>[g.learnerId,g.outcome]));
   if(!ids.length||map.size!==ids.length||input.grades.length!==ids.length||ids.some(id=>!map.has(id)))fail('INCOMPLETE_GRADING','Grade every learner in this cohort before submitting.');
   if(ids.some(id=>!c.sessions.some(s=>s.attendance.some(a=>a.learnerId===id))))fail('ATTENDANCE_REQUIRED','Attendance must be recorded for every learner before grading.',409);
   await tx.assessment.createMany({data:input.grades.map(g=>({...g,cohortId:c.id,assessorId:req.actor.id}))});
   for(const grade of input.grades){
    const learner=c.enrolments.find(e=>e.learnerId===grade.learnerId)!.learner;
    const data=reportPdf('AgriProvider assessor report | '+c.code+' | '+learner.fullName+' | '+grade.outcome+' | '+req.actor.fullName);
    const storageKey=await storage.put(data,'application/pdf');
    for(const m of c.milestones)await tx.evidence.create({data:{milestoneId:m.id,scopeLearnerId:grade.learnerId,type:'ASSESSOR_REPORT',storageKey,fileName:'assessor-report-'+learner.fullName+'.pdf',mime:'application/pdf',size:data.length,checksum:checksum(data),ownerId:req.actor.id,learnerIds:[grade.learnerId],scanStatus:'GENERATED'}});
   }
   await resetReview(tx,c);await audit(tx,req.actor,'ASSESSMENTS_SUBMITTED',c.id,{count:ids.length},input.clientOpId);await notify(tx,['PROVIDER'],'Assessment results are available for '+c.code,c.providerId);return {ok:true};
  });
 });
 app.post('/api/v1/assessor/moderation/:id',async req=>{
  const input=z.object({action:z.enum(['SIGN_OFF','FLAG','REOPEN']),reason:reasonSchema.optional(),identitiesMatch:z.boolean().optional(),outcomesRecorded:z.boolean().optional(),signaturesPresent:z.boolean().optional()}).strict().parse(req.body);
  return mutate(req.actor,undefined,input,async tx=>{
   const c=await cohortFor(tx,req.actor,params(req),true);await editable(tx,c);
   if(c.assessments.some(a=>a.assessorId===req.actor.id))fail('SEPARATION_OF_DUTIES','An independent assessor must moderate this cohort.',403);
   if(input.action==='SIGN_OFF'){
    if(!input.identitiesMatch||!input.outcomesRecorded||!input.signaturesPresent||!c.assessments.length||c.milestones.some(m=>packStatus(c,m).some(e=>e.status!=='Uploaded')))fail('CHECKLIST_INCOMPLETE','All evidence and checklist items must pass before sign-off.',409);
   }else if(!input.reason)fail('REASON_REQUIRED','Explain the issue in at least 10 characters.');
   if(input.action==='REOPEN'){await tx.assessment.deleteMany({where:{cohortId:c.id}});await resetReview(tx,c);}
   await tx.moderationReview.create({data:{cohortId:c.id,moderatorId:req.actor.id,status:input.action==='SIGN_OFF'?'SIGNED_OFF':input.action==='REOPEN'?'REOPENED':'FLAGGED',reason:input.reason}});
   await audit(tx,req.actor,'MODERATION_'+input.action,c.id,{reason:input.reason??''});
   await notify(tx,['PROVIDER','QA_OFFICER'],'Moderation '+input.action.toLowerCase()+' for '+c.code,c.providerId);return {ok:true};
  });
 });
 app.get('/api/v1/assessor/slots',async req=>db.moderationSlot.findMany({where:{assessorId:req.actor.id},include:{cohort:{include:{programme:true}}},orderBy:{startsAt:'asc'},take:100}));
 app.post('/api/v1/assessor/slots',async req=>{
  const v=z.object({cohortId:uuid,startsAt:z.string().datetime(),endsAt:z.string().datetime(),type:z.enum(['Evidence review','Final review'])}).strict().parse(req.body);
  return mutate(req.actor,undefined,v,async tx=>{await cohortFor(tx,req.actor,v.cohortId,true);if(v.startsAt>=v.endsAt)fail('INVALID_TIME','End time must be after start time.');if(await tx.moderationSlot.findFirst({where:{assessorId:req.actor.id,startsAt:{lt:new Date(v.endsAt)},endsAt:{gt:new Date(v.startsAt)}}}))fail('OVERLAPPING_SLOT','This time overlaps another moderation slot.',409);const s=await tx.moderationSlot.create({data:{...v,assessorId:req.actor.id}});await audit(tx,req.actor,'SLOT_CREATED',s.id);return s;});
 });
 app.get('/api/v1/qa/audits',async()=>db.milestone.findMany({include:{cohort:{include:{provider:true,programme:true}},findings:true},orderBy:[{submittedAt:{sort:'asc',nulls:'last'}},{createdAt:'asc'}],take:100}));
 app.post('/api/v1/qa/milestones/:id/:action',async req=>{
  const p=z.object({id:uuid,action:z.enum(['verify','unlock','reject'])}).parse(req.params);
  const input=z.object({condition:z.enum(['enrolment','attendance','certification']).optional(),reason:z.string().trim().min(1).max(2000).optional(),evidenceIds:z.array(uuid).optional()}).strict().parse(req.body??{});
  return mutate(req.actor,undefined,{p,input},async tx=>{
   const m=await tx.milestone.findUnique({where:{id:p.id}});if(!m)fail('NOT_FOUND','Milestone not found.',404);
   const c=await cohortFor(tx,req.actor,m.cohortId);if(p.action!=='reject')await editable(tx,c);
   if(p.action!=='reject'&&m.state!=='READY_FOR_REVIEW')fail('INVALID_TRANSITION','This milestone is not ready for QA review.',409);
   if(p.action==='verify'){
    if(!input.condition)fail('CONDITION_REQUIRED','Choose a condition to verify.');
    if(!conditions(c,c.milestones.find(x=>x.id===m.id))[input.condition])fail('CONDITION_INCOMPLETE','The underlying records do not meet this condition.',409);
    await tx.milestone.update({where:{id:m.id},data:{[input.condition+'Condition']:'VERIFIED'}});
   }else if(p.action==='reject'){
    if(!input.reason)fail('REASON_REQUIRED','Explain what needs correction.');
    input.evidenceIds=input.evidenceIds?.length?input.evidenceIds:c.milestones.find(x=>x.id===m.id)!.evidence.map(e=>e.id);
    if(input.evidenceIds.some(id=>!c.milestones.find(x=>x.id===m.id)!.evidence.some(e=>e.id===id)))fail('NOT_FOUND','Evidence not found.',404);
    await tx.evidence.updateMany({where:{id:{in:input.evidenceIds},milestoneId:m.id},data:{status:'REJECTED'}});
    await tx.learnerPack.updateMany({where:{cohortId:c.id},data:{status:'CHANGES_REQUESTED',reason:input.reason}});
    await tx.milestone.update({where:{id:m.id},data:{unlockedAt:null,state:'REJECTED',rejectionReason:input.reason,enrolmentCondition:'PENDING',attendanceCondition:'PENDING',certificationCondition:'PENDING'}});
   }else {
    const underlying=conditions(c,c.milestones.find(x=>x.id===m.id));
    if(![m.enrolmentCondition,m.attendanceCondition,m.certificationCondition].every(v=>v==='VERIFIED')||!Object.values(underlying).every(Boolean)||await tx.finding.count({where:{providerId:c.providerId,status:'FOLLOW-UP',OR:[{milestoneId:null},{milestoneId:m.id}]}}))fail('MILESTONE_BLOCKED','Verify all conditions and resolve linked follow-up findings before unlocking.',409);
    await tx.milestone.update({where:{id:m.id},data:{state:'UNLOCKED',unlockedAt:new Date()}});
    const payload={milestoneId:m.id,cohortId:c.id,providerId:c.providerId,passedLearnerIds:c.assessments.filter(a=>a.outcome==='PASS').map(a=>a.learnerId)};
    await tx.certificationEvent.upsert({where:{milestoneId:m.id},create:{milestoneId:m.id,payload},update:{payload}});await tx.outboxEvent.create({data:{type:'CERTIFICATION',payload}});
   }
   await audit(tx,req.actor,'QA_'+p.action.toUpperCase(),m.id,{condition:input.condition??'',reason:input.reason??''});
   await notify(tx,['PROVIDER'],'QA '+p.action+' for '+c.code,c.providerId);return {ok:true};
  });
 });
 app.get('/api/v1/qa/findings',async()=>db.finding.findMany({orderBy:{createdAt:'desc'},take:100}));
 app.post('/api/v1/qa/findings/:id',async req=>{
  const input=z.object({milestoneId:uuid,evidenceId:uuid,status:z.enum(['SELECTED','VERIFIED','FOLLOW-UP'])}).strict().parse(req.body);
  return mutate(req.actor,undefined,input,async tx=>{
   const f=await tx.finding.findUnique({where:{id:params(req)}});const e=await tx.evidence.findUnique({where:{id:input.evidenceId},include:{milestone:{include:{cohort:true}}}});
   if(!f||!e||e.milestoneId!==input.milestoneId||e.milestone.cohort.providerId!==f.providerId)fail('NOT_FOUND','Choose evidence from the same provider.',404);
   if(f.evidenceIds.includes(e.id)&&f.status===input.status)fail('DUPLICATE_LINK','This finding is already linked.',409);
   const r=await tx.finding.update({where:{id:f.id},data:{milestoneId:e.milestoneId,status:input.status,evidenceIds:[...new Set([...f.evidenceIds,e.id])]}});
   await audit(tx,req.actor,'FINDING_LINKED',f.id);return r;
  });
 });
 app.post('/api/v1/qa/recommend-suspension',async req=>{const input=z.object({providerId:uuid,reason:reasonSchema}).strict().parse(req.body);return mutate(req.actor,undefined,input,async tx=>{const a=await tx.approvalRequest.create({data:{requesterId:req.actor.id,action:'RECOMMEND_SUSPENSION',payload:input,expiresAt:new Date(Date.now()+48*3600000)}});await audit(tx,req.actor,'SUSPENSION_RECOMMENDED',input.providerId);await notify(tx,['ADMIN'],'QA recommends provider suspension.');return a;});});
 for(const role of ['provider','assessor','qa','admin'])app.get('/api/v1/'+role+'/evidence/:id/download',async req=>{
  const e=await db.evidence.findUnique({where:{id:params(req)},include:{milestone:true}});if(!e)fail('NOT_FOUND','File not found.',404);
  if(role==='admin'){if(!await db.supportGrant.findFirst({where:{userId:req.actor.id,entityId:e.id,expiresAt:{gt:new Date()}}}))fail('SUPPORT_ACCESS_REQUIRED','Request time-limited support access first.',403);}
  else await cohortFor(db,req.actor,e.milestone.cohortId);
  await audit(db,req.actor,'EVIDENCE_DOWNLOADED',e.id);
  return {url:await storage.download(e.storageKey)};
 });
}
