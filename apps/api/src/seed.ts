import { pathToFileURL } from 'node:url';
import { authenticator } from 'otplib';
import argon2 from 'argon2';
import { db,transaction,system,encrypt,hash,audit } from './core.js';
import { invite } from './admin.js';
import { defaultSettings,validSaId } from '@agri/shared';
import { env } from './config.js';
export const demoPassword='Harvest!Demo2026';
export const demoMfaSecret='JBSWY3DPEHPK3PXP';
export function fakeId(index:number){const base='900101'+String(5000+index).padStart(4,'0')+'08';for(let digit=0;digit<10;digit++){const id=base+digit;if(validSaId(id))return id;}throw new Error('Synthetic ID generation failed');}
export async function seed(){
 if(env.NODE_ENV==='production')throw new Error('Demo seed is disabled in production.');
 if(await db.user.count()){await seedLearnerAccounts();return;}
 const passwordHash=await argon2.hash(demoPassword);
 await transaction(async tx=>{
  await tx.systemSetting.create({data:{version:1,value:defaultSettings}});
  const providers=[];
  for(const [i,name] of ['Thandi Agri Training','Mvelo Rural Skills','Siyakhula Learning'].entries())providers.push(await tx.provider.create({data:{name,accreditationNumber:'DEMO-ACC-'+(i+1),validFrom:new Date('2026-01-01'),validTo:new Date('2028-12-31'),province:'KwaZulu-Natal',contact:'contact'+i+'@example.test'}}));
  const programme=await tx.programme.create({data:{name:'Maize Production',level:'L1',requiredSessions:1,attendanceThreshold:80,assessmentType:'Practical & knowledge assessment'}});
  const cohorts=[];
  for(let i=0;i<3;i++){const c=await tx.cohort.create({data:{providerId:providers[i].id,programmeId:programme.id,code:'DEMO-2026-0'+(i+1),capacity:i===0?6:5,startDate:new Date('2026-10-01'),endDate:new Date('2026-12-31')}});cohorts.push(c);await tx.trainingSession.create({data:{cohortId:c.id,startsAt:new Date('2026-11-10T06:00:00Z')}});await tx.milestone.create({data:{cohortId:c.id,label:'Milestone 01',config:{requiredSessions:1,attendanceThreshold:80,version:1}}});}
  const users=[
   {email:'admin@agriprovider.test',fullName:'Demo Administrator',role:'ADMIN' as const},
   {email:'qa@agriprovider.test',fullName:'Naledi Quality',role:'QA_OFFICER' as const},
   {email:'provider@agriprovider.test',fullName:'Thandi Dlamini',role:'PROVIDER' as const,providerId:providers[0].id},
   {email:'provider2@agriprovider.test',fullName:'Mvelo Training',role:'PROVIDER' as const,providerId:providers[1].id},
   {email:'assessor@agriprovider.test',fullName:'Sibusiso Mthembu',role:'ASSESSOR' as const,cohortIds:cohorts.map(c=>c.id)},
   {email:'moderator@agriprovider.test',fullName:'Lindiwe Khumalo',role:'ASSESSOR' as const,cohortIds:cohorts.map(c=>c.id)}
  ];
  for(const input of users){const u=await invite(tx,system,input);await tx.user.update({where:{id:u.id},data:{passwordHash,status:'ACTIVE',...(input.role==='ADMIN'?{mfaSecret:encrypt(demoMfaSecret),mfaEnabled:true}:{})}});await tx.oneTimeToken.updateMany({where:{userId:u.id},data:{usedAt:new Date()}});}
  for(const [i,fullName] of ['Nomsa Nkosi','Lerato Dube','Sipho Mthembu','Ayanda Zulu','Bongani Ndlovu'].entries()){
   const id=fakeId(i);const l=await tx.learner.create({data:{fullName,nationalIdEncrypted:encrypt(id),nationalIdHash:hash(id),idLastFour:id.slice(-4),phoneEncrypted:encrypt('+27821234567'),consentAt:new Date(),consentVersion:'2026-01'}});
   await tx.enrolment.create({data:{cohortId:cohorts[0].id,programmeId:programme.id,learnerId:l.id,nationalIdHash:hash(id)}});
  }
  await tx.finding.create({data:{providerId:providers[0].id,officerName:'Zanele Khumalo',region:'Newcastle',description:'Certificate pack requires a signature before verification.',status:'SELECTED'}});
  await audit(tx,system,'DEMO_SEEDED','development');
 });
 await seedLearnerAccounts();
 // Demo invitations were consumed; do not send unusable invitation messages.
 await db.outboxEvent.updateMany({where:{type:'EMAIL'},data:{status:'DELIVERED'}});
}
// Add only missing synthetic learner logins; existing development records remain intact.
async function seedLearnerAccounts(){
 const provider=await db.user.findUnique({where:{email:'provider@agriprovider.test'}});
 if(!provider?.providerId)return;
 for(const [i,fullName] of ['Nomsa Nkosi','Lerato Dube'].entries()){
  const learner=await db.learner.findFirst({where:{fullName,enrolments:{some:{cohort:{providerId:provider.providerId}}}},include:{account:true}});
  if(learner&&!learner.account){const email=i?'learner2@agriprovider.test':'learner@agriprovider.test';if(!await db.user.findUnique({where:{email}}))await db.user.create({data:{email,fullName,role:'LEARNER',learnerId:learner.id,status:'ACTIVE',passwordHash:await argon2.hash(demoPassword)}});}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await seed();console.log('Synthetic demo accounts ready. See README for credentials. Admin TOTP:',authenticator.generate(demoMfaSecret));await db.$disconnect();}
