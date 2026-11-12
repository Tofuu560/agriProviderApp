import { db,transaction,audit,system,notify,settings,decrypt } from './core.js';
import { sendMail } from './mail.js';
import { env } from './config.js';
export async function dispatch(){
 await db.outboxEvent.updateMany({where:{status:'PROCESSING',nextAttemptAt:{lt:new Date()}},data:{status:'PENDING'}});
 const candidates=await db.outboxEvent.findMany({where:{status:'PENDING',nextAttemptAt:{lte:new Date()}},take:20,orderBy:{createdAt:'asc'}});
 for(const item of candidates){
  const claim=await db.outboxEvent.updateMany({where:{id:item.id,status:'PENDING'},data:{status:'PROCESSING',nextAttemptAt:new Date(Date.now()+60000)}});if(!claim.count)continue;
  try{
   const p=item.payload as any;
   if(item.type==='NOTIFICATION'){const users=await db.user.findMany({where:{id:{in:p.userIds},status:'ACTIVE'},select:{pushTokens:true}});const messages=users.flatMap(u=>u.pushTokens.map(to=>({to,title:'AgriProvider',body:p.message,sound:'default'})));for(let i=0;i<messages.length;i+=100){const r=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(messages.slice(i,i+100)),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Push delivery failed');const result:any=await r.json();if(result.errors?.length||result.data?.some((x:any)=>x.status==='error'))throw new Error('Push ticket rejected');}}
   if(item.type==='EMAIL')await sendMail(p.to,p.subject,decrypt(p.encryptedText),item.id);
   if(item.type==='CERTIFICATION'&&!await db.milestone.findFirst({where:{id:p.milestoneId,state:'UNLOCKED'}})){await db.outboxEvent.update({where:{id:item.id},data:{status:'CANCELLED',lastError:'Certification reopened for review.'}});continue;}
   if(item.type==='CERTIFICATION'&&env.PASSPORT_URL){const r=await fetch(env.PASSPORT_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.PASSPORT_KEY,'Idempotency-Key':item.id},body:JSON.stringify(p),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Passport returned '+r.status);}
   await db.outboxEvent.update({where:{id:item.id},data:{status:'DELIVERED',attempts:{increment:1},lastError:null}});
  }catch{
   const max=(await settings()).outboxRetries;
   await db.outboxEvent.update({where:{id:item.id},data:{status:item.attempts+1>=max?'FAILED':'PENDING',attempts:{increment:1},lastError:'Delivery failed; inspect integration configuration.',nextAttemptAt:new Date(Date.now()+Math.min(3600000,1000*2**item.attempts)+Math.random()*1000)}});
  }
 }
 await db.jobHeartbeat.upsert({where:{name:'outbox'},create:{name:'outbox'},update:{lastRun:new Date()}});
}
export async function housekeeping(){return transaction(async tx=>{
 await tx.oneTimeToken.updateMany({where:{expiresAt:{lt:new Date()},usedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
 await tx.approvalRequest.updateMany({where:{expiresAt:{lt:new Date()},status:'PENDING'},data:{status:'EXPIRED'}});
 await tx.user.updateMany({where:{status:'LOCKED',lockedUntil:{lt:new Date()}},data:{status:'ACTIVE',failures:0,lockedUntil:null}});
 for(const p of await tx.provider.findMany({where:{status:'ACCREDITED',validTo:{lt:new Date()}}})){
  await tx.provider.update({where:{id:p.id},data:{status:'SUSPENDED',reason:'Accreditation expired.'}});
  for(const m of await tx.milestone.findMany({where:{cohort:{providerId:p.id},state:{notIn:['UNLOCKED','FROZEN']}}}))await tx.milestone.update({where:{id:m.id},data:{previousState:m.state,state:'FROZEN'}});
  await audit(tx,system,'ACCREDITATION_EXPIRED',p.id);await notify(tx,['ADMIN','PROVIDER'],'Accreditation expired for '+p.name,p.id);
 }
 await tx.jobHeartbeat.upsert({where:{name:'housekeeping'},create:{name:'housekeeping'},update:{lastRun:new Date()}});
 return {ok:true};
});}
