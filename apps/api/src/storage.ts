import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client,PutObjectCommand,GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env,dataDir } from './config.js';
import { fail,hash } from './core.js';
export interface StorageProvider { put(data:Buffer,mime:string):Promise<string>; read(key:string):Promise<Buffer>; download(key:string):Promise<string>; }
const client=env.STORAGE_MODE==='s3'?new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION,credentials:{accessKeyId:env.S3_ACCESS_KEY??'',secretAccessKey:env.S3_SECRET_KEY??''}}):null;
export const storage:StorageProvider={
 async put(data,mime){const key=randomUUID();if(client)await client.send(new PutObjectCommand({Bucket:env.S3_BUCKET,Key:key,Body:data,ContentType:mime}));else {await mkdir(join(dataDir,'files'),{recursive:true});await writeFile(join(dataDir,'files',key),data);}return key;},
 async read(key){if(!/^[a-f0-9-]{36}$/.test(key))fail('NOT_FOUND','File not found.',404);if(client){const r=await client.send(new GetObjectCommand({Bucket:env.S3_BUCKET,Key:key}));return Buffer.from(await r.Body!.transformToByteArray());}return readFile(join(dataDir,'files',key));},
 async download(key){if(client)return getSignedUrl(client,new GetObjectCommand({Bucket:env.S3_BUCKET,Key:key}),{expiresIn:120});const expires=Date.now()+120000;return '/files/'+key+'?expires='+expires+'&signature='+hash(key+':'+expires);}
};
export function detectMime(b:Buffer){if(b.subarray(0,5).toString()==='%PDF-')return 'application/pdf';if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';return null;}
export async function scan(data:Buffer){
 if(data.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))fail('UNSAFE_FILE','This file failed the security scan.');
 // Local development scanning is deliberately labelled; production fails closed until an external scanner is configured.
 if(env.CLAMSCAN_PATH){const dir=join(dataDir,'scan');await mkdir(dir,{recursive:true});const path=join(dir,randomUUID());await writeFile(path,data);try{await promisify(execFile)(env.CLAMSCAN_PATH,['--no-summary',path],{timeout:30000,windowsHide:true,maxBuffer:65536});return 'CLEAN';}catch(e){if((e as any).code===1)fail('UNSAFE_FILE','This file failed the security scan.');fail('SCANNER_UNAVAILABLE','Virus scanning is temporarily unavailable. Please retry.',503);}finally{await unlink(path).catch(()=>{});}}
 if(env.NODE_ENV==='production')fail('SCANNER_UNAVAILABLE','Virus scanning is not configured. Upload is blocked.',503);
 return 'DEV_CHECKED';
}
export function reportPdf(text:string){const escaped=text.replace(/[()\\]/g,' ').replace(/[^\x20-\x7E]/g,' ');const stream='BT /F1 10 Tf 40 760 Td ('+escaped.slice(0,180)+') Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];let s='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const x=s.length;s+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF';return Buffer.from(s);}
