import {encrypt,type Tx,type Actor} from './core.js';
import {env} from './config.js';
export async function queueAccountMail(tx:Tx,to:string,subject:string,text:string){
 await tx.outboxEvent.create({data:{type:'EMAIL',payload:{to,subject,encryptedText:encrypt(text)}}});
}
export async function confirmAccountCreated(tx:Tx,actor:Actor,email:string){
 if(actor.role==='SYSTEM')return;
 await queueAccountMail(tx,actor.email,'AgriProvider account created','You created an account for '+email+'. A separate setup message has been queued for that address. Sign in at '+env.APP_URL+'.');
}
