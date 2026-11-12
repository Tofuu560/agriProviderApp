import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import net from 'node:net';
import {PrismaClient} from '@prisma/client';

const root=fileURLToPath(new URL('..',import.meta.url));
const database=process.env.TEST_WEB_DATABASE_URL??'postgresql://agri@127.0.0.1:55432/agriprovider_web_test';
const parsed=new URL(database),name=parsed.pathname.slice(1);
// This runner clears fixtures. It must never target the user's working database.
if(!/^[a-zA-Z0-9_]+_web_test$/.test(name))throw new Error('Browser tests require a dedicated database ending in _web_test.');
const adminUrl=new URL(database);adminUrl.pathname='/postgres';
const admin=new PrismaClient({datasourceUrl:adminUrl.toString()});
const exists=await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname=${name}`;
if(!exists.length)await admin.$executeRawUnsafe('CREATE DATABASE "'+name+'"');
await admin.$disconnect();
const output=resolve(root,'.data/web-test');await mkdir(output,{recursive:true});
const env={...process.env,NODE_ENV:'test',DATABASE_URL:database,DIRECT_URL:database,PORT:'4001',APP_URL:'http://localhost:4174',CORS_ORIGINS:'http://localhost:4174',INLINE_WORKER:'false',EXPO_PUBLIC_API_URL:'http://localhost:4001',WEB_PORT:'4174',WEB_ROOT:output,WEB_EXPORT_DIR:output,WEB_TEST_URL:'http://localhost:4174'};
const services=[];
const stop=()=>{for(const child of services)child.kill();};
process.on('SIGINT',()=>{stop();process.exit(130);});process.on('SIGTERM',()=>{stop();process.exit(143);});
function run(args){return new Promise((resolve,reject)=>{const manager=process.env.npm_execpath;if(!manager||!/[.](c|m)?js$/.test(manager))return reject(new Error('Run this script through pnpm test:web.'));const child=spawn(process.execPath,[manager,...args],{cwd:root,env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Command failed: pnpm '+args.join(' '))));});}
async function unused(port){await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error('Test port '+port+' is already in use.')));server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
async function ready(url){for(let i=0;i<60;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Test service did not become ready: '+url);}
try{
 await unused(4001);await unused(4174);
 await run(['db:migrate']);
 const db=new PrismaClient({datasourceUrl:database});
 try{const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
 if(tables.length)await db.$executeRawUnsafe('TRUNCATE '+tables.map(t=>'"'+t.tablename.replaceAll('"','""')+'"').join(',')+' CASCADE');}finally{await db.$disconnect();}
 await run(['seed']);
 await run(['--filter','@agri/mobile','exec','expo','export','-p','web','--output-dir','../../.data/web-test']);
 const post=spawn(process.execPath,['scripts/postbuild-web.mjs'],{cwd:root,env,stdio:'inherit',windowsHide:true});await new Promise((resolve,reject)=>post.on('exit',c=>c===0?resolve():reject(new Error('Precache generation failed.'))));
 services.push(spawn(process.execPath,['--import','tsx','apps/api/src/server.ts'],{cwd:root,env,stdio:'inherit',windowsHide:true}));
 services.push(spawn(process.execPath,['scripts/serve-web.mjs'],{cwd:root,env,stdio:'inherit',windowsHide:true}));
 await ready('http://localhost:4001/readyz');await ready('http://localhost:4174');
 await run(['exec','playwright','test',...process.argv.slice(2)]);
}finally{stop();}
