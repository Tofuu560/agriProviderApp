import { mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTransport } from 'nodemailer';
import { env,dataDir } from './config.js';
export async function sendMail(to:string,subject:string,text:string,id:string){
 if(env.MAIL_MODE==='smtp'){if(!env.SMTP_URL)throw new Error('SMTP_URL missing');await createTransport(env.SMTP_URL).sendMail({from:env.MAIL_FROM,to,subject,text});}
 else {await mkdir(join(dataDir,'mail'),{recursive:true});await writeFile(join(dataDir,'mail',id+'.json'),JSON.stringify({to,subject,text},null,2));}
}
