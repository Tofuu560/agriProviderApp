import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {authenticator} from 'otplib';
import {config} from 'dotenv';
config({path:'.env',quiet:true});
const url=process.env.TEST_DATABASE_URL??'postgresql://agri@127.0.0.1:55432/agriprovider_test';
if(!new URL(url).pathname.endsWith('_test'))throw new Error('A dedicated _test database is required.');
process.env.DATABASE_URL=url;process.env.DIRECT_URL=url;process.env.NODE_ENV='test';process.env.MAIL_MODE='local';
let app:any,db:any,core:any,seed:any,cohort:any;let learnerId:string,otherId:string;
const tokens:Record<string,string>={};let address=0;
async function call(role:string,method:string,path:string,payload?:any){return app.inject({method,url:'/api/v1'+path,remoteAddress:'10.0.'+Math.floor(++address/250)+'.'+(address%250+1),headers:tokens[role]?{authorization:'Bearer '+tokens[role]}:{},payload});}
async function login(email:string,password='Harvest!Demo2026',code?:string){return call('','POST','/auth/login',{email,password,transport:'native',...(code?{code}:{})});}
beforeAll(async()=>{
 core=await import('../src/core.js');db=core.db;seed=await import('../src/seed.js');
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
 await db.$executeRawUnsafe('TRUNCATE '+tables.map((t:any)=>'"'+t.tablename+'"').join(',')+' CASCADE');await seed.seed();
 app=await (await import('../src/app.js')).createApp();await app.ready();
 for(const name of ['admin','provider','provider2','assessor','qa','learner','learner2']){const r=await login(name+'@agriprovider.test',undefined,name==='admin'?authenticator.generate(seed.demoMfaSecret):undefined);expect(r.statusCode,r.body).toBe(200);tokens[name]=r.json().accessToken;}
 cohort=(await call('provider','GET','/provider/cohorts')).json()[0];learnerId=cohort.enrolments.find((e:any)=>e.learner.fullName==='Nomsa Nkosi').learnerId;otherId=cohort.enrolments.find((e:any)=>e.learner.fullName==='Lerato Dube').learnerId;
});
afterAll(async()=>{await app?.close();await db?.$disconnect();});

async function upload(role:string,id:string,type='ID_DOCUMENTS',data=Buffer.from('%PDF-1.4 test document'),op=randomUUID()){
 const boundary='test-'+randomUUID();const meta={type,clientOpId:op,...(type==='CERTIFICATES'?{signed:true,signerName:'Test Signer'}:{})};
 const payload=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="test-document.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),data,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 return app.inject({method:'POST',url:'/api/v1/'+(role==='provider2'?'provider':role)+'/cohorts/'+cohort.id+'/learner-packs/'+id+'/files',headers:{authorization:'Bearer '+tokens[role],'content-type':'multipart/form-data; boundary='+boundary},payload});
}
const path=(role:string,id=learnerId)=>'/'+role+'/cohorts/'+cohort.id+'/learner-packs/'+id+'/submit';
it('interprets calendar input as SAST regardless of device time zone',async()=>{const {sastIso,formatSast}=await import('../../mobile/src/lib/dates');expect(sastIso('2026-12-01T08:00')).toBe('2026-12-01T06:00:00.000Z');expect(sastIso('2026-12-01')).toBe('2026-11-30T22:00:00.000Z');expect(formatSast('2026-12-01T06:00:00Z')).toContain('08:00');});
describe.sequential('Individual learner documents and reviewer handoffs',()=>{
 it('lets learners upload only their own documents, without waiting for assessment',async()=>{
  expect((await upload('learner',learnerId)).statusCode).toBe(200);
  expect((await upload('learner',otherId)).statusCode).toBe(404);
  expect((await upload('learner',learnerId,'CERTIFICATES')).statusCode).toBe(403);
  expect((await upload('provider2',learnerId)).statusCode).toBe(404);
 });
 it('appends new files, replays offline operations once and preserves earlier downloads',async()=>{
  const before=await db.evidence.findFirst({where:{scopeLearnerId:learnerId,type:'ID_DOCUMENTS'}}),op=randomUUID();
  const a=await upload('learner',learnerId,'ID_DOCUMENTS',Buffer.from('%PDF-1.4 second'),op),b=await upload('learner',learnerId,'ID_DOCUMENTS',Buffer.from('%PDF-1.4 second'),op);
  expect(a.statusCode,a.body).toBe(200);expect(a.json().id).toBe(b.json().id);expect(a.json().id).not.toBe(before.id);
  expect(await db.evidence.count({where:{scopeLearnerId:learnerId,type:'ID_DOCUMENTS'}})).toBe(2);
  const first=await db.evidence.findUnique({where:{id:before.id}});expect(first.storageKey).toBe(before.storageKey);expect(first.checksum).toBe(before.checksum);
  expect((await call('learner','GET','/learner/evidence/'+before.id+'/download')).statusCode).toBe(200);
  expect((await call('learner2','GET','/learner/evidence/'+before.id+'/download')).statusCode).toBe(404);
 });
 it('returns one private learner pack and separates provider packs by learner',async()=>{
  const r=await call('learner','GET','/learner/cohorts/'+cohort.id+'/learner-packs');expect(r.json()).toHaveLength(1);expect(r.body).not.toContain('Lerato');expect(r.body).not.toContain('storageKey');
  const p=await call('provider','GET','/provider/cohorts/'+cohort.id+'/learner-packs');expect(p.json().length).toBe(cohort.enrolments.length);
  expect(p.json().find((x:any)=>x.learnerId===otherId).files).toEqual([]);
 });
 it('requires a complete initial learner pack and rejects premature reviewer approval',async()=>{
  expect((await call('provider','POST',path('provider'),{action:'SUBMIT'})).statusCode).toBe(400);
  expect((await call('qa','POST',path('qa'),{action:'APPROVE'})).statusCode).toBe(409);
  for(const type of ['ENROLMENT_LIST','CONSENT_FORMS','ATTENDANCE_LOG'])expect((await upload('provider',learnerId,type)).statusCode).toBe(200);
  expect((await call('provider','POST',path('provider'),{action:'SUBMIT'})).json().status).toBe('ASSESSOR_REVIEW');
  expect((await call('assessor','POST',path('assessor'),{action:'APPROVE'})).statusCode).toBe(400);
 });
 it('creates a separate assessor report per learner and accepts any certificate file in testing',async()=>{
  for(const session of cohort.sessions)await db.attendance.createMany({data:cohort.enrolments.map((e:any)=>({sessionId:session.id,learnerId:e.learnerId,status:'PRESENT',recordedBy:randomUUID()}))});
  const r=await call('assessor','POST','/assessor/assessments',{cohortId:cohort.id,grades:cohort.enrolments.map((e:any)=>({learnerId:e.learnerId,outcome:'PASS'})),clientOpId:randomUUID()});expect(r.statusCode,r.body).toBe(200);
  expect(await db.evidence.count({where:{type:'ASSESSOR_REPORT',scopeLearnerId:learnerId}})).toBe(1);
  const cert=await upload('provider',learnerId,'CERTIFICATES',Buffer.from('Synthetic certificate text'));expect(cert.statusCode,cert.body).toBe(200);
  expect((await upload('learner',learnerId,'ID_DOCUMENTS',Buffer.from('not a PDF'))).statusCode).toBe(400);
  expect((await upload('provider',learnerId,'CERTIFICATES',Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))).statusCode).toBe(400);
 });
 it('hands this learner to assessor then QA without submitting their classmates',async()=>{
  expect((await call('provider','POST',path('provider'),{action:'SUBMIT'})).statusCode).toBe(200);
  expect((await call('assessor','POST',path('assessor'),{action:'APPROVE'})).json().status).toBe('QA_REVIEW');
  expect((await call('qa','POST',path('qa'),{action:'APPROVE'})).json().status).toBe('VERIFIED');
  expect(await db.learnerPack.count({where:{learnerId:otherId}})).toBe(0);
 });
 it('QA can request re-upload with a short message even after unlock; blank is rejected',async()=>{
  await db.milestone.update({where:{id:cohort.milestones[0].id},data:{state:'UNLOCKED',unlockedAt:new Date()}});
  expect((await call('qa','POST',path('qa'),{action:'REQUEST_CHANGES',reason:' '})).statusCode).toBe(400);
  expect((await call('qa','POST',path('qa'),{action:'REQUEST_CHANGES',reason:'Blurred'})).statusCode).toBe(200);
  expect((await db.milestone.findUnique({where:{id:cohort.milestones[0].id}})).state).toBe('REJECTED');
  expect((await call('provider','POST',path('provider'),{action:'SUBMIT'})).statusCode).toBe(400);
  expect((await upload('learner',learnerId)).statusCode).toBe(200);
  expect((await call('qa','POST','/qa/milestones/'+cohort.milestones[0].id+'/reject',{reason:'Fix'})).statusCode).toBe(200);
 });
 it('queues a private setup link for the new learner and a confirmation for the creator',async()=>{
  const l=cohort.enrolments.find((e:any)=>![learnerId,otherId].includes(e.learnerId));
  const email='welcome@example.test',r=await call('provider','POST','/provider/learners/'+l.learnerId+'/account',{email,password:'Harvest!New2027'});expect(r.statusCode,r.body).toBe(200);
  const messages=await db.outboxEvent.findMany({where:{type:'EMAIL'}}),mine=messages.filter((m:any)=>m.payload.to===email);
  expect(mine).toHaveLength(1);expect(core.decrypt(mine[0].payload.encryptedText)).toContain('/reset-password?token=');
  const confirmation=messages.find((m:any)=>m.payload.to==='provider@agriprovider.test'&&m.payload.subject==='AgriProvider account created');expect(core.decrypt(confirmation.payload.encryptedText)).toContain(email);expect(JSON.stringify(messages)).not.toContain('Harvest!New2027');
  const {sendMail}=await import('../src/mail.js'),{dataDir}=await import('../src/config.js'),{readFile}=await import('node:fs/promises'),{join}=await import('node:path');
  await sendMail(email,mine[0].payload.subject,core.decrypt(mine[0].payload.encryptedText),mine[0].id);const saved=JSON.parse(await readFile(join(dataDir,'mail',mine[0].id+'.json'),'utf8'));expect(saved.to).toBe(email);expect(saved.text).toContain('/reset-password?token=');
 });
 it('allows only providers to create and close their own cohorts',async()=>{
  const body={providerId:cohort.providerId,programmeId:cohort.programmeId,code:'OWNED',capacity:4,startDate:'2026-01-01T00:00:00Z',endDate:'2027-12-31T00:00:00Z',sessionDates:cohort.sessions.map((s:any)=>s.startsAt)};
  expect((await call('admin','POST','/admin/cohorts',body)).statusCode).toBe(404);
  expect((await call('admin','PATCH','/admin/cohorts/'+cohort.id,{status:'CLOSED'})).statusCode).toBe(404);
  const r=await call('provider','POST','/provider/cohorts',body);expect(r.statusCode,r.body).toBe(200);
  expect((await call('provider2','PATCH','/provider/cohorts/'+r.json().id,{status:'CLOSED'})).statusCode).toBe(404);
  expect((await call('provider','PATCH','/provider/cohorts/'+r.json().id,{status:'CLOSED'})).statusCode).toBe(200);
  expect((await call('provider','PATCH','/provider/cohorts/'+r.json().id,{status:'ACTIVE'})).statusCode).toBe(200);
 });
 it('validates province and phone country at signup',async()=>{
  const body={email:'location@example.test',fullName:'New Applicant',password:'Rainy!Seasons2027',role:'PROVIDER',organisation:'Test Farm',accreditationNumber:'LOC123',country:'ZA',province:'Gauteng',phone:'+27821234567'};
  expect((await call('','POST','/auth/signup',{...body,province:'California'})).statusCode).toBe(400);
  expect((await call('','POST','/auth/signup',{...body,phone:'+14155552671'})).statusCode).toBe(400);
  expect((await call('','POST','/auth/signup',{...body,country:'US',province:'California',phone:'+14155552671'})).statusCode).toBe(200);
  const u=await db.user.findUnique({where:{email:body.email}});expect(u.phone).not.toBe('+14155552671');expect(core.decrypt(u.phone)).toBe('+14155552671');
 });
});
