import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import { config } from 'dotenv';
config({path:'.env',quiet:true});
const testUrl=process.env.TEST_DATABASE_URL??'postgresql://agri@127.0.0.1:55432/agriprovider_test';
if(!new URL(testUrl).pathname.endsWith('_test'))throw new Error('Tests require a dedicated _test database.');
process.env.DATABASE_URL=testUrl;process.env.DIRECT_URL=testUrl;process.env.NODE_ENV='test';
let app:any,db:any,seedModule:any,core:any;
const tokens:Record<string,string>={};let cohort:any,otherCohort:any,milestoneId:string;
async function call(role:string,method:string,url:string,payload?:any){return app.inject({method,url:'/api/v1'+url,headers:{...(tokens[role]?{authorization:'Bearer '+tokens[role]}:{})},payload});}
async function login(name:string){const r=await call('', 'POST','/auth/login',{email:name+'@agriprovider.test',password:seedModule.demoPassword,transport:'native',...(name==='admin'?{code:authenticator.generate(seedModule.demoMfaSecret)}:{})});expect(r.statusCode,r.body).toBe(200);tokens[name]=r.json().accessToken;return r.json();}
async function refreshCohort(){const r=await call('provider','GET','/provider/cohorts/'+cohort.id);expect(r.statusCode,r.body).toBe(200);cohort=r.json();}
async function upload(type:string,signed=false,expected=200){
 const b='agri-'+randomUUID(),pdf=Buffer.from('%PDF-1.4\nSynthetic test evidence\n%%EOF');
 const meta={type,learnerIds:type==='CERTIFICATES'?cohort.assessments.filter((a:any)=>a.outcome==='PASS').map((a:any)=>a.learnerId):type==='ATTENDANCE_LOG'?[]:cohort.enrolments.map((e:any)=>e.learnerId),sessionIds:type==='ATTENDANCE_LOG'?cohort.sessions.map((s:any)=>s.id):[],signed,...(signed?{signerName:'Demo Signer',signedAt:new Date().toISOString()}:{}),clientOpId:randomUUID()};
 const payload=Buffer.concat([Buffer.from('--'+b+'\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+b+'\r\nContent-Disposition: form-data; name="file"; filename="evidence.pdf"\r\nContent-Type: application/pdf\r\n\r\n'),pdf,Buffer.from('\r\n--'+b+'--\r\n')]);
 const r=await app.inject({method:'POST',url:'/api/v1/provider/evidence/'+milestoneId,headers:{authorization:'Bearer '+tokens.provider,'content-type':'multipart/form-data; boundary='+b},payload});expect(r.statusCode,r.body).toBe(expected);return r.json();
}
beforeAll(async()=>{
 core=await import('../src/core.js');db=core.db;seedModule=await import('../src/seed.js');
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
 if(tables.length)await db.$executeRawUnsafe('TRUNCATE '+tables.map((t:any)=>'"'+t.tablename+'"').join(',')+' CASCADE');
 await seedModule.seed();app=await (await import('../src/app.js')).createApp();await app.ready();
 for(const name of ['provider','provider2','assessor','moderator','qa','admin'])await login(name);
 cohort=(await call('provider','GET','/provider/cohorts')).json()[0];otherCohort=(await call('provider2','GET','/provider/cohorts')).json()[0];milestoneId=cohort.milestones[0].id;
});
afterAll(async()=>{await app?.close();await db?.$disconnect();});
describe.sequential('Security and golden journey',()=>{
 it('does not trust email text or an incorrect password',async()=>{const r=await call('','POST','/auth/login',{email:'provider@agriprovider.test',password:'not the password',transport:'native'});expect(r.statusCode).toBe(401);expect(r.json().message).toBe('Incorrect email or password');});
 it('requires admin MFA',async()=>{const r=await call('','POST','/auth/login',{email:'admin@agriprovider.test',password:seedModule.demoPassword,transport:'native'});expect(r.statusCode).toBe(401);expect(r.json().code).toBe('MFA_REQUIRED');});
 it('isolates all four role namespaces',async()=>{for(const [namespace,owner] of [['provider','provider'],['assessor','assessor'],['qa','qa'],['admin','admin']])for(const role of ['provider','assessor','qa','admin'])if(role!==owner){const path=namespace==='qa'?'/audits':namespace==='admin'?'/users':'/cohorts';expect((await call(role,'GET','/'+namespace+path)).statusCode).toBe(403);}});
 it('blocks cross-provider reads and admin learner access',async()=>{expect((await call('provider','GET','/provider/cohorts/'+otherCohort.id)).statusCode).toBe(404);expect((await call('admin','GET','/provider/cohorts/'+cohort.id)).statusCode).toBe(403);});
 it('does not return encrypted or plaintext learner secrets',async()=>{const r=await call('provider','GET','/provider/cohorts/'+cohort.id);expect(r.body).not.toContain('nationalIdEncrypted');expect(r.body).not.toContain('phoneEncrypted');expect(r.body).not.toContain(seedModule.fakeId(0));});
 it('rejects malformed ID, missing consent, duplicate programme enrolment',async()=>{
  const input={cohortId:cohort.id,fullName:'New Learner',phone:'+27821234567',nationalId:'letters',consent:true,clientOpId:randomUUID()};
  expect((await call('provider','POST','/provider/learners',input)).statusCode).toBe(400);
  expect((await call('provider','POST','/provider/learners',{...input,nationalId:seedModule.fakeId(8),consent:false})).statusCode).toBe(400);
  expect((await call('provider','POST','/provider/learners',{...input,nationalId:seedModule.fakeId(0)})).statusCode).toBe(409);
 });
 it('enrols exactly once and blocks capacity overflow',async()=>{
  const input={cohortId:cohort.id,fullName:'New Learner',phone:'+27821234567',nationalId:seedModule.fakeId(8),consent:true,clientOpId:randomUUID()};
  const first=await call('provider','POST','/provider/learners',input);expect(first.statusCode,first.body).toBe(200);
  expect((await call('provider','POST','/provider/learners',input)).json().id).toBe(first.json().id);
  expect((await call('provider','POST','/provider/learners',{...input,nationalId:seedModule.fakeId(9),clientOpId:randomUUID()})).statusCode).toBe(409);await refreshCohort();
 });
 it('blocks grading before attendance and milestone uploads before assessment',async()=>{
  const result=await call('assessor','POST','/assessor/assessments',{cohortId:cohort.id,grades:cohort.enrolments.map((e:any)=>({learnerId:e.learnerId,outcome:'PASS'})),clientOpId:randomUUID()});expect(result.statusCode).toBe(409);expect(result.json().code).toBe('ATTENDANCE_REQUIRED');
  const uploaded=await upload('ENROLMENT_LIST',false,409);expect(uploaded.code).toBe('ASSESSMENT_REQUIRED');
 });
 it('rejects unmarked attendance and replays one offline operation exactly once',async()=>{
  const op=randomUUID(),sessionId=cohort.sessions[0].id;
  expect((await call('provider','POST','/provider/attendance',{sessionId,records:[{learnerId:cohort.enrolments[0].learnerId,status:'PRESENT'}],clientOpId:randomUUID()})).statusCode).toBe(400);
  const input={sessionId,records:cohort.enrolments.map((e:any)=>({learnerId:e.learnerId,status:'PRESENT'})),clientOpId:op};
  for(let i=0;i<2;i++)expect((await call('provider','POST','/provider/attendance',input)).statusCode).toBe(200);
  expect(await db.attendance.count({where:{sessionId}})).toBe(6);
  expect((await call('provider','POST','/provider/attendance',{...input,records:input.records.map((r:any)=>({...r,status:'ABSENT'}))})).statusCode).toBe(409);
 });
 it('cannot unlock an incomplete milestone',async()=>expect((await call('qa','POST','/qa/milestones/'+milestoneId+'/unlock',{})).statusCode).toBe(409));
 it('requires complete atomic grading and forbids self moderation',async()=>{
  const input={cohortId:cohort.id,grades:cohort.enrolments.map((e:any)=>({learnerId:e.learnerId,outcome:'PASS'})),clientOpId:randomUUID()};
  expect((await call('assessor','POST','/assessor/assessments',{...input,grades:input.grades.slice(1)})).statusCode).toBe(400);
  const r=await call('assessor','POST','/assessor/assessments',input);expect(r.statusCode,r.body).toBe(200);
  expect((await call('assessor','POST','/assessor/assessments',{...input,clientOpId:randomUUID()})).statusCode).toBe(409);
  expect((await call('assessor','POST','/assessor/moderation/'+cohort.id,{action:'FLAG',reason:'Certificate requires correction.'})).statusCode).toBe(403);await refreshCohort();
 });
 it('flags missing certificate signatures',async()=>{
  for(const t of ['ENROLMENT_LIST','ID_DOCUMENTS','CONSENT_FORMS','ATTENDANCE_LOG','CERTIFICATES'])await upload(t);
  await refreshCohort();expect(cohort.packs[0].items.find((e:any)=>e.type==='CERTIFICATES').status).toBe('Missing signature');
  expect((await call('moderator','POST','/assessor/moderation/'+cohort.id,{action:'SIGN_OFF',identitiesMatch:true,outcomesRecorded:true,signaturesPresent:true})).statusCode).toBe(409);
 });
 it('allows an independent sign-off, then QA review and unlock',async()=>{
  await upload('CERTIFICATES',true);
  let r=await call('moderator','POST','/assessor/moderation/'+cohort.id,{action:'SIGN_OFF',identitiesMatch:true,outcomesRecorded:true,signaturesPresent:true});expect(r.statusCode,r.body).toBe(200);
  r=await call('provider','POST','/provider/milestones/'+milestoneId+'/submit',{});expect(r.statusCode,r.body).toBe(200);
  for(const condition of ['enrolment','attendance','certification']){r=await call('qa','POST','/qa/milestones/'+milestoneId+'/verify',{condition});expect(r.statusCode,r.body).toBe(200);}
  expect((await call('admin','POST','/qa/milestones/'+milestoneId+'/unlock',{})).statusCode).toBe(403);
  r=await call('qa','POST','/qa/milestones/'+milestoneId+'/unlock',{});expect(r.statusCode,r.body).toBe(200);
  expect(await db.certificationEvent.count({where:{milestoneId}})).toBe(1);
  expect((await call('qa','POST','/qa/milestones/'+milestoneId+'/unlock',{})).statusCode).toBe(409);
 });
 it('locks attendance after verification',async()=>{const r=await call('provider','POST','/provider/attendance',{sessionId:cohort.sessions[0].id,records:cohort.enrolments.map((e:any)=>({learnerId:e.learnerId,status:'ABSENT'})),clientOpId:randomUUID()});expect(r.statusCode).toBe(409);});
 it('audit rows reject database updates and deletes',async()=>{const row=await db.auditLog.findFirst();await expect(db.auditLog.update({where:{id:row.id},data:{action:'tampered'}})).rejects.toThrow();await expect(db.auditLog.delete({where:{id:row.id}})).rejects.toThrow();});
 it('rejects invite scope omissions and duplicate emails',async()=>{expect((await call('admin','POST','/admin/users',{email:'new@example.test',fullName:'New Provider',role:'PROVIDER'})).statusCode).toBe(400);expect((await call('admin','POST','/admin/users',{email:'PROVIDER@agriprovider.test',fullName:'New Provider',role:'PROVIDER',providerId:cohort.providerId})).statusCode).toBe(409);});
 it('uses single-use password reset tokens and revokes old sessions',async()=>{
  const r=await call('','POST','/auth/forgot-password',{email:'provider2@agriprovider.test'});expect(r.statusCode).toBe(200);
  const event=await db.outboxEvent.findFirst({where:{type:'EMAIL'},orderBy:{createdAt:'desc'}});const text=core.decrypt(event.payload.encryptedText);const raw=text.match(/token=([^\s]+)/)[1];
  const t=await db.oneTimeToken.findUnique({where:{hash:core.hash(raw)}});expect(t.hash).not.toBe(raw);
  const body={token:raw,password:'New!HarvestPassword2026',transport:'native'};
  const reset=await call('','POST','/auth/reset-password',body);expect(reset.statusCode,reset.body).toBe(200);
  expect((await call('provider2','GET','/provider/cohorts')).statusCode).toBe(401);
  expect((await call('','POST','/auth/reset-password',body)).statusCode).toBe(400);
 });
 it('invalidates a token family on refresh-token reuse',async()=>{
  const session=await login('assessor');let r=await call('','POST','/auth/refresh',{refreshToken:session.refreshToken,transport:'native'});expect(r.statusCode).toBe(200);const next=r.json();
  r=await call('','POST','/auth/refresh',{refreshToken:session.refreshToken,transport:'native'});expect(r.statusCode).toBe(401);
  r=await call('','POST','/auth/refresh',{refreshToken:next.refreshToken,transport:'native'});expect(r.statusCode).toBe(401);
 });
 it('requires a different admin for sensitive changes',async()=>{
  const source=await db.user.findUnique({where:{email:'admin@agriprovider.test'}});
  await db.user.create({data:{email:'second-admin@agriprovider.test',fullName:'Second Admin',role:'ADMIN',status:'ACTIVE',passwordHash:source.passwordHash,mfaEnabled:true,mfaSecret:source.mfaSecret}});
  const value=await core.settings();const r=await call('admin','POST','/admin/settings',{...value,idleMinutes:25});expect(r.statusCode).toBe(200);expect(r.json().pending).toBe(true);
  expect((await call('admin','POST','/admin/approvals/'+r.json().approvalId,{approve:true})).statusCode).toBe(403);
  expect((await core.settings()).idleMinutes).toBe(value.idleMinutes);
 });
});