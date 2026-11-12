// Executes only the credential-free, read-only smoke folder and its actual Postman assertions.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {expect} from 'chai';
const collection=JSON.parse(await readFile('docs/postman/AgriProvider.postman_collection.json','utf8'));
const baseUrl=process.argv[2]??'http://localhost:4000';
if(!/^http:\/\/(localhost|127\.0\.0\.1):(4000|4001)$/.test(baseUrl))throw Error('Use a local API endpoint.');
const results=[];
for(const item of collection.item.find(f=>f.name==='01 Read-only smoke').item){
 if(item.request.method!=='GET')throw Error('Smoke execution must remain read-only.');
 const response=await fetch(item.request.url.replace('{{baseUrl}}',baseUrl),{signal:AbortSignal.timeout(30000)});
 const body=await response.json();let assertions=0;
 const pm={response:{code:response.status,json:()=>body},expect,test(name,fn){fn();assertions++;}};
 for(const event of item.event??[])if(event.listen==='test')vm.runInNewContext(event.script.exec.join('\n'),{pm},{timeout:1000});
 results.push({case:item.name,status:response.status,assertions,result:'PASS'});
 console.log(`${item.name}: PASS (${assertions} assertions)`);
}
await mkdir('.data/docs-preview',{recursive:true});
await writeFile('.data/docs-preview/postman-smoke-results.json',JSON.stringify({baseUrl,executedAt:new Date().toISOString(),results},null,2)+'\n');
