import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {authenticator} from 'otplib';
import {config} from 'dotenv';
config({path:'.env',quiet:true});
const url=process.env.TEST_DATABASE_URL??'postgresql://agri@127.0.0.1:55432/agriprovider_test';
if(!new URL(url).pathname.endsWith('_test'))throw new Error('A dedicated _test database is required.');
process.env.DATABASE_URL=url;process.env.DIRECT_URL=url;process.env.NODE_ENV='test';
let app:any,db:any,core:any,seed:any,cohort:any,auth:any;
const tokens:Record<string,string>={};let address=0;
async function call(role:string,method:string,path:string,payload?:any){return app.inject({method,url:'/api/v1'+path,remoteAddress:'10.0.'+Math.floor(++address/250)+'.'+(address%250+1),headers:tokens[role]?{authorization:'Bearer '+tokens[role]}:{},payload});}
async function login(email:string,password='Harvest!Demo2026',code?:string){return call('','POST','/auth/login',{email,password,transport:'native',...(code?{code}:{})});}
beforeAll(async()=>{
 core=await import('../src/core.js');db=core.db;seed=await import('../src/seed.js');auth=await import('../src/auth.js');
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
 await db.$executeRawUnsafe('TRUNCATE '+tables.map((t:any)=>'"'+t.tablename+'"').join(',')+' CASCADE');await seed.seed();
 app=await (await import('../src/app.js')).createApp();await app.ready();
 for(const name of ['admin','provider','provider2','assessor','qa','learner','learner2']){const r=await login(name+'@agriprovider.test',undefined,name==='admin'?authenticator.generate(seed.demoMfaSecret):undefined);expect(r.statusCode,r.body).toBe(200);tokens[name]=r.json().accessToken;}
 cohort=(await call('provider','GET','/provider/cohorts')).json()[0];
});
afterAll(async()=>{await app?.close();await db?.$disconnect();});
describe.sequential('Five portal onboarding and isolation',()=>{
 it('denies every other role in each namespace, including Learner',async()=>{
  for(const [owner,path] of [['admin','/admin/users'],['provider','/provider/cohorts'],['assessor','/assessor/cohorts'],['qa','/qa/audits'],['learner','/learner/courses']])for(const role of ['admin','provider','assessor','qa','learner'])if(role!==owner)expect((await call(role,'GET',path)).statusCode).toBe(403);
 });
 it('does not allow public admin or learner sign-up, role escalation, or tenant selection',async()=>{
  const base={email:'attack@example.test',fullName:'New Applicant',password:'Summer!Rain2026',organisation:'Test Organisation'};
  for(const role of ['ADMIN','LEARNER'])expect((await call('','POST','/auth/signup',{...base,role})).statusCode).toBe(400);
  expect((await call('','POST','/auth/signup',{...base,role:'ASSESSOR',providerId:cohort.providerId,status:'ACTIVE'})).statusCode).toBe(400);
 });
 it('keeps every self-registered staff role pending without tokens or dashboard access',async()=>{
  for(const role of ['PROVIDER','ASSESSOR','QA_OFFICER']){
   const email=role.toLowerCase()+'-new@example.test';
   const r=await call('','POST','/auth/signup',{email,role,fullName:'New Applicant',password:'Summer!Rain2026',organisation:'New Organisation',...(role==='PROVIDER'?{accreditationNumber:'NEW-123',province:'Limpopo'}:{})});
   expect(r.statusCode,r.body).toBe(200);expect(r.json().status).toBe('PENDING');expect(r.json().accessToken).toBeUndefined();expect(r.headers['set-cookie']).toBeUndefined();
   const l=await login(email,'Summer!Rain2026');expect(l.statusCode).toBe(403);expect(l.json().code).toBe('ACCOUNT_PENDING');
   const u=await db.user.findUnique({where:{email}});expect(await db.authSession.count({where:{userId:u.id}})).toBe(0);
   if(role==='PROVIDER')expect((await db.provider.findUnique({where:{id:u.providerId}})).status).toBe('PENDING');
  }
 });
 it('blocks invitation, reset, and generic admin-action bypasses for pending accounts',async()=>{
  const u=await db.user.findUnique({where:{email:'assessor-new@example.test'}});
  for(const kind of ['RESET','INVITE']){
   const raw=await core.transaction((tx:any)=>auth.issueToken(tx,u.id,kind));
   expect((await call('','POST','/auth/token-info',{token:raw})).statusCode).toBe(400);
   expect((await call('','POST',kind==='RESET'?'/auth/reset-password':'/auth/accept-invite',{token:raw,password:'Changed!Rain2026'})).statusCode).toBe(400);
  }
  expect((await call('admin','POST','/admin/users/'+u.id+'/reactivate',{})).statusCode).toBe(409);
  expect((await call('provider','POST','/admin/pending-accounts/'+u.id,{approve:true})).statusCode).toBe(403);
 });
 it('requires accreditation review, approves once, and gives no unassigned cohort access',async()=>{
  const provider=await db.user.findUnique({where:{email:'provider-new@example.test'}});
  expect((await call('admin','POST','/admin/pending-accounts/'+provider.id,{approve:true})).statusCode).toBe(400);
  expect((await call('admin','POST','/admin/pending-accounts/'+provider.id,{approve:true,validFrom:'2026-01-01T00:00:00Z',validTo:'2028-01-01T00:00:00Z'})).statusCode).toBe(200);
  const u=await db.user.findUnique({where:{email:'assessor-new@example.test'}});
  expect((await call('admin','POST','/admin/pending-accounts/'+u.id,{approve:true})).statusCode).toBe(200);
  expect((await call('admin','POST','/admin/pending-accounts/'+u.id,{approve:true})).statusCode).toBe(409);
  const r=await login(u.email,'Summer!Rain2026');expect(r.statusCode).toBe(200);tokens.newAssessor=r.json().accessToken;
  expect((await call('newAssessor','GET','/assessor/cohorts')).json()).toEqual([]);
  expect((await call('newAssessor','GET','/assessor/cohorts/'+cohort.id)).statusCode).toBe(404);
 });
 it('rejects accounts with an audit trail and prevents login',async()=>{
  const u=await db.user.findUnique({where:{email:'qa_officer-new@example.test'}});
  expect((await call('admin','POST','/admin/pending-accounts/'+u.id,{approve:false})).statusCode).toBe(400);
  expect((await call('admin','POST','/admin/pending-accounts/'+u.id,{approve:false,reason:'The supplied credentials could not be verified.'})).statusCode).toBe(200);
  expect((await login(u.email,'Summer!Rain2026')).statusCode).toBe(401);
  expect(await db.auditLog.count({where:{action:'ACCOUNT_REJECTED',entityId:u.id}})).toBe(1);
 });
 it('issues an MFA-only QR challenge and creates a session only after confirmation',async()=>{
  const source=await db.user.findUnique({where:{email:'admin@agriprovider.test'}});
  const u=await db.user.create({data:{email:'setup-admin@example.test',fullName:'Setup Administrator',role:'ADMIN',status:'ACTIVE',passwordHash:source.passwordHash}});
  const r=await login(u.email);expect(r.statusCode).toBe(200);const c=r.json();expect(c.mfaSetupRequired).toBe(true);expect(c.qrDataUrl).toMatch(/^data:image\/png;base64,/);expect(c.accessToken).toBeUndefined();expect(r.headers['set-cookie']).toBeUndefined();
  expect(await db.authSession.count({where:{userId:u.id}})).toBe(0);
  tokens.challenge=c.setupToken;expect((await call('challenge','GET','/admin/users')).statusCode).toBe(401);
  expect((await call('','POST','/auth/mfa/complete',{setupToken:c.setupToken,code:'000000',transport:'native'})).statusCode).toBe(401);
  const payload={setupToken:c.setupToken,code:authenticator.generate(c.secret),transport:'native'};
  const verified=await call('','POST','/auth/mfa/complete',payload);expect(verified.statusCode,verified.body).toBe(200);expect(verified.json().recoveryCodes).toHaveLength(8);
  expect((await call('','POST','/auth/mfa/complete',payload)).statusCode).toBe(401);
  const code=verified.json().recoveryCodes[0];expect((await login(u.email,undefined,code)).statusCode).toBe(200);expect((await login(u.email,undefined,code)).statusCode).toBe(401);
 });
 it('restricts learner account creation to the owning provider',async()=>{
  const l=cohort.enrolments.find((e:any)=>e.learner.fullName==='Sipho Mthembu').learner;
  const payload={email:'sipho@example.test',password:'Safe!Learning2026'};
  expect((await call('provider2','POST','/provider/learners/'+l.id+'/account',payload)).statusCode).toBe(404);
  expect((await call('provider','POST','/provider/learners/'+l.id+'/account',payload)).statusCode).toBe(200);
  expect((await call('provider','POST','/provider/learners/'+l.id+'/account',payload)).statusCode).toBe(409);
  const r=await login(payload.email,payload.password);expect(r.json().user.role).toBe('LEARNER');
 });
 it('returns only the signed-in learner attendance and results, never classmates or evidence',async()=>{
  const first=cohort.enrolments.find((e:any)=>e.learner.fullName==='Nomsa Nkosi').learnerId;
  const second=cohort.enrolments.find((e:any)=>e.learner.fullName==='Lerato Dube').learnerId;
  await db.attendance.createMany({data:[{learnerId:first,sessionId:cohort.sessions[0].id,status:'PRESENT',recordedBy:randomUUID()},{learnerId:second,sessionId:cohort.sessions[0].id,status:'ABSENT',recordedBy:randomUUID()}]});
  const a=await call('learner','GET','/learner/courses'),b=await call('learner2','GET','/learner/courses');
  expect(a.json()[0].lessons[0].attendance).toBe('PRESENT');expect(b.json()[0].lessons[0].attendance).toBe('ABSENT');
  for(const secret of ['Lerato','nationalId','phoneEncrypted','storageKey','enrolments','assessorId'])expect(a.body).not.toContain(secret);
  expect((await call('learner','GET','/provider/cohorts/'+cohort.id)).statusCode).toBe(403);
  expect((await call('learner','GET','/learner/courses/'+second)).statusCode).toBe(404);
 });
 it('shows certification only after QA unlock, and only to a passing learner',async()=>{
  const nomsa=cohort.enrolments.find((e:any)=>e.learner.fullName==='Nomsa Nkosi').learnerId;
  const lerato=cohort.enrolments.find((e:any)=>e.learner.fullName==='Lerato Dube').learnerId;
  await db.assessment.createMany({data:[{cohortId:cohort.id,learnerId:nomsa,assessorId:randomUUID(),outcome:'PASS'},{cohortId:cohort.id,learnerId:lerato,assessorId:randomUUID(),outcome:'FAIL'}]});
  const milestoneId=cohort.milestones[0].id;
  await db.certificationEvent.create({data:{milestoneId,payload:{privateCohortData:'must not be returned'}}});
  expect((await call('learner','GET','/learner/courses')).json()[0].certificates).toEqual([]);
  await db.milestone.update({where:{id:milestoneId},data:{state:'UNLOCKED',unlockedAt:new Date()}});
  const r=await call('learner','GET','/learner/courses');expect(r.json()[0].certificates[0].learnerName).toBe('Nomsa Nkosi');expect(r.body).not.toContain('privateCohortData');
  expect((await call('learner2','GET','/learner/courses')).json()[0].certificates).toEqual([]);
 });
 it('publishes materials only to enrolled learners and rejects unsafe links and tenant writes',async()=>{
  const payload={title:'Soil preparation',content:'Prepare the soil and review the lesson before class.'};
  expect((await call('provider2','POST','/provider/cohorts/'+cohort.id+'/materials',payload)).statusCode).toBe(404);
  expect((await call('provider','POST','/provider/cohorts/'+cohort.id+'/materials',{...payload,url:'javascript:alert(1)'})).statusCode).toBe(400);
  expect((await call('provider','POST','/provider/cohorts/'+cohort.id+'/materials',payload)).statusCode).toBe(200);
  expect((await call('learner','GET','/learner/courses')).json()[0].materials[0].title).toBe(payload.title);
 });
 it('creates provider-owned programmes and rejects incomplete schedules',async()=>{
  const body={programme:{name:'Soil Health',level:'L1',requiredSessions:1,attendanceThreshold:80,assessmentType:'Practical'},cohort:{code:'NEW-COURSE',capacity:12,startDate:'2026-01-01T00:00:00Z',endDate:'2027-12-31T00:00:00Z',sessionDates:['2026-12-01T08:00:00Z']}};
  expect((await call('provider','POST','/provider/programmes',{...body,cohort:{...body.cohort,sessionDates:['2029-01-01T08:00:00Z']}})).statusCode).toBe(400);
  const r=await call('provider','POST','/provider/programmes',body);expect(r.statusCode,r.body).toBe(200);
  expect((await db.cohort.findUnique({where:{id:r.json().id}})).providerId).toBe(cohort.providerId);
 });
});
