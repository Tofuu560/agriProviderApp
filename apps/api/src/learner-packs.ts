import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {evidenceTypes} from '@agri/shared';
import {db,fail,mutate,cohortFor,audit,checksum,notify,settings} from './core.js';
import {storage,detectMime,scan} from './storage.js';
import {learnerPackStatus,resetReview} from './domain.js';
import {env} from './config.js';
const types=[...evidenceTypes,'SUPPORTING_DOCUMENT'] as const;
export async function learnerPackRoutes(app:FastifyInstance){
 for(const role of ['learner','provider','assessor','qa']){
  const base='/api/v1/'+role+'/cohorts/:id/learner-packs';
  async function scope(req:any,tx:any=db){
   const id=z.string().uuid().parse(req.params.id);
   if(role==='learner'){
    const u=await tx.user.findUniqueOrThrow({where:{id:req.actor.id}});
    if(!u.learnerId||!await tx.enrolment.findUnique({where:{cohortId_learnerId:{cohortId:id,learnerId:u.learnerId}}}))fail('NOT_FOUND','Course not found.',404);
    return {c:await cohortFor(tx,req.actor,id),own:u.learnerId};
   }
   return {c:await cohortFor(tx,req.actor,id),own:null};
  }
  app.get(base,async req=>{
   const {c,own}=await scope(req);const m=c.milestones[0];if(!m)return [];
   const packs=await db.learnerPack.findMany({where:{cohortId:c.id}});
   return c.enrolments.filter((e:any)=>!own||e.learnerId===own).map((e:any)=>{
    const p=packs.find(p=>p.learnerId===e.learnerId);
    // Learners see only individually scoped documents, never shared cohort files.
    const files=m.evidence.filter((f:any)=>f.scopeLearnerId===e.learnerId).sort((a:any,b:any)=>b.createdAt.getTime()-a.createdAt.getTime());
    return {learnerId:e.learnerId,fullName:e.learner.fullName,status:p?.status??'DRAFT',reason:p?.reason,assessorId:own?undefined:p?.assessorId,
     items:own?undefined:learnerPackStatus(c,m,e.learnerId),
     files:files.map((f:any)=>({id:f.id,type:f.type,fileName:f.fileName,createdAt:f.createdAt,status:f.status,uploadedByLearner:f.ownerId===req.actor.id})),
     allowAnyCertificateFile:env.NODE_ENV!=='production'};
   });
  });
  if(['learner','provider'].includes(role))app.post(base+'/:learnerId/files',async req=>{
   const learnerId=z.string().uuid().parse((req.params as any).learnerId);
   const part=await req.file({limits:{fileSize:(await settings()).maxFileMb*1024*1024}});if(!part)fail('FILE_REQUIRED','Choose a file.');
   const data=await part.toBuffer();if(part.file.truncated)fail('FILE_TOO_LARGE','File exceeds upload limit.',413);
   let raw;try{raw=JSON.parse(String((part.fields as any).metadata?.value??'{}'));}catch{fail('INVALID_METADATA','Invalid document details.');}
   const v=z.object({type:z.enum(types),signed:z.boolean().default(false),signerName:z.string().trim().optional(),clientOpId:z.string().uuid()}).strict().parse(raw);
   if(role==='learner'&&!['ID_DOCUMENTS','CONSENT_FORMS','SUPPORTING_DOCUMENT'].includes(v.type))fail('FORBIDDEN','Learners may upload ID, consent and supporting documents only.',403);
   if(v.type==='ASSESSOR_REPORT')fail('FORBIDDEN','The assessor supplies assessment reports.',403);
   const mime=detectMime(data)??(v.type==='CERTIFICATES'&&env.NODE_ENV!=='production'?'application/octet-stream':null);
   if(!mime)fail('INVALID_FILE','Use a genuine PDF, JPG or PNG document.');
   if(v.type==='CERTIFICATES'&&(!v.signed||!v.signerName))fail('SIGNATURE_REQUIRED','Confirm the signature and enter the signer name.');
   const scanStatus=await scan(data),sum=checksum(data);
   return mutate(req.actor,v.clientOpId,{...v,learnerId,cohortId:(req.params as any).id,checksum:sum},async tx=>{
    const {c,own}=await scope(req,tx);if(own&&own!==learnerId||!c.enrolments.some((e:any)=>e.learnerId===learnerId))fail('NOT_FOUND','Learner not found.',404);
    await cohortFor(tx,req.actor,c.id,true);
    const m=c.milestones[0];if(!m)fail('NOT_FOUND','Evidence pack not configured.',404);
    if(['UNLOCKED','FROZEN'].includes(m.state))fail('MILESTONE_LOCKED','QA must request corrections before new documents can be added.',409);
    if(v.type==='CERTIFICATES'&&!c.assessments.some((a:any)=>a.learnerId===learnerId&&a.outcome==='PASS'))fail('INVALID_CERTIFICATE','A certificate requires a passing assessment.');
    const storageKey=await storage.put(data,mime);
    const e=await tx.evidence.create({data:{milestoneId:m.id,scopeLearnerId:learnerId,type:v.type,storageKey,fileName:part.filename.slice(0,200),mime,size:data.length,checksum:sum,ownerId:req.actor.id,learnerIds:[learnerId],sessionIds:v.type==='ATTENDANCE_LOG'?c.sessions.map((s:any)=>s.id):[],signed:v.signed,signerName:v.signerName,signedAt:v.signed?new Date():null,scanStatus}});
    await tx.learnerPack.upsert({where:{cohortId_learnerId:{cohortId:c.id,learnerId}},create:{cohortId:c.id,learnerId},update:{status:'DRAFT',assessorId:null}});
    await resetReview(tx,c);await audit(tx,req.actor,'LEARNER_DOCUMENT_UPLOADED',e.id,{learnerId,type:v.type},v.clientOpId);
    await notify(tx,['PROVIDER'],'A document was added for '+c.enrolments.find((e:any)=>e.learnerId===learnerId)!.learner.fullName,c.providerId);
    return {id:e.id};
   });
  });
  if(role!=='learner')app.post(base+'/:learnerId/submit',async req=>{
   const learnerId=z.string().uuid().parse((req.params as any).learnerId);
   const v=z.object({action:z.enum(['SUBMIT','APPROVE','REQUEST_CHANGES']),reason:z.string().trim().max(2000).optional()}).strict().parse(req.body);
   return mutate(req.actor,undefined,{...v,learnerId,cohortId:(req.params as any).id},async tx=>{
    const {c}=await scope(req,tx);if(!c.enrolments.some((e:any)=>e.learnerId===learnerId))fail('NOT_FOUND','Learner not found.',404);
    const m=c.milestones[0];if(!m)fail('NOT_FOUND','Milestone not found.',404);
    const p=await tx.learnerPack.findUnique({where:{cohortId_learnerId:{cohortId:c.id,learnerId}}});
    let status:string;
    if(v.action==='REQUEST_CHANGES'){
     if(role==='provider')fail('FORBIDDEN','Only reviewers may request corrections.',403);
     if(!v.reason)fail('REASON_REQUIRED','Enter a message for the provider.');
     status='CHANGES_REQUESTED';await resetReview(tx,c);
     await tx.evidence.updateMany({where:{milestoneId:m.id,scopeLearnerId:learnerId,type:{not:'ASSESSOR_REPORT'}},data:{status:'REJECTED'}});
     await tx.milestone.update({where:{id:m.id},data:{unlockedAt:null,state:'REJECTED',rejectionReason:v.reason}});
    }else{
     await cohortFor(tx,req.actor,c.id,true);
     if(['UNLOCKED','FROZEN'].includes(m.state))fail('MILESTONE_LOCKED','QA must reopen this milestone.',409);
     const items=learnerPackStatus(c,m,learnerId);
     if(role==='provider'&&v.action==='SUBMIT'){
      if(items.filter(i=>['ID_DOCUMENTS','CONSENT_FORMS','ENROLMENT_LIST','ATTENDANCE_LOG'].includes(i.type)).some(i=>i.status!=='Uploaded'))fail('INCOMPLETE_EVIDENCE','Add enrolment, ID, consent and attendance documents for this learner.');
      status='ASSESSOR_REVIEW';
     }else if(role==='assessor'&&v.action==='APPROVE'){
      if(p?.status!=='ASSESSOR_REVIEW')fail('INVALID_TRANSITION','The provider must submit this learner pack first.',409);
      if(items.some(i=>i.status!=='Uploaded'))fail('INCOMPLETE_EVIDENCE','Complete this learner assessment and all required evidence first.');
      status='QA_REVIEW';
     }else if(role==='qa'&&v.action==='APPROVE'){
      if(p?.status!=='QA_REVIEW')fail('INVALID_TRANSITION','The assessor must forward this learner pack first.',409);
      if(items.some(i=>i.status!=='Uploaded'))fail('INCOMPLETE_EVIDENCE','This learner pack is incomplete.');
      status='VERIFIED';
     }else fail('FORBIDDEN','This action is not available to your role.',403);
    }
    await tx.learnerPack.upsert({where:{cohortId_learnerId:{cohortId:c.id,learnerId}},create:{cohortId:c.id,learnerId,status,reason:v.reason,submittedAt:new Date(),assessorId:role==='assessor'?req.actor.id:null},update:{status,reason:v.reason??null,submittedAt:new Date(),...(role==='assessor'&&status==='QA_REVIEW'?{assessorId:req.actor.id}:{})}});
    if(status==='QA_REVIEW'){const packs=await tx.learnerPack.findMany({where:{cohortId:c.id}});if(c.enrolments.every((e:any)=>packs.some(p=>p.learnerId===e.learnerId&&['QA_REVIEW','VERIFIED'].includes(p.status))))await tx.milestone.update({where:{id:m.id},data:{state:'READY_FOR_REVIEW',submittedAt:new Date()}});}
    await audit(tx,req.actor,'LEARNER_PACK_'+status,learnerId,{cohortId:c.id,reason:v.reason??''});
    await notify(tx,status==='ASSESSOR_REVIEW'?['ASSESSOR']:status==='QA_REVIEW'?['QA_OFFICER']:['PROVIDER'],c.enrolments.find((e:any)=>e.learnerId===learnerId)!.learner.fullName+' · '+status.replaceAll('_',' '),c.providerId,c.id);
    return {status};
   });
  });
 }
 app.get('/api/v1/learner/evidence/:id/download',async req=>{
  const id=z.string().uuid().parse((req.params as any).id),u=await db.user.findUniqueOrThrow({where:{id:req.actor.id}});
  const e=await db.evidence.findUnique({where:{id},include:{milestone:true}});
  if(!e||!u.learnerId||e.scopeLearnerId!==u.learnerId||!await db.enrolment.findUnique({where:{cohortId_learnerId:{cohortId:e.milestone.cohortId,learnerId:u.learnerId}}}))fail('NOT_FOUND','Document not found.',404);
  await audit(db,req.actor,'EVIDENCE_DOWNLOADED',e.id);return {url:await storage.download(e.storageKey)};
 });
}
