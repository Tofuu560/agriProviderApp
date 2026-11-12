// Capture route registration without starting a server or executing handlers.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const rows:{method:string;path:string;source:string}[]=[];
for(const [file,name] of Object.entries({auth:'authRoutes',account:'accountRoutes',admin:'adminRoutes',domain:'domainRoutes',onboarding:'onboardingRoutes',learning:'learningRoutes','learner-packs':'learnerPackRoutes'})){
 const capture:any={addHook(){}};
 for(const method of ['get','post','patch','put','delete'])capture[method]=(path:string)=>rows.push({method:method.toUpperCase(),path,source:`apps/api/src/${file}.ts`});
 const mod=await import(`../apps/api/src/${file}.ts`);await mod[name](capture);
}
const source=await readFile('apps/api/src/app.ts','utf8');
for(const match of source.matchAll(/app\.(get|post|patch|put|delete)\('([^']+)'/g))rows.push({method:match[1].toUpperCase(),path:match[2],source:'apps/api/src/app.ts'});
rows.sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
await mkdir('docs/api',{recursive:true});
await writeFile('docs/api/route-inventory.json',JSON.stringify(rows,null,2)+'\n');
console.log(`Documented ${rows.length} routes without executing requests.`);
