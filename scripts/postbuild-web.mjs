import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.WEB_EXPORT_DIR?resolve(process.env.WEB_EXPORT_DIR):fileURLToPath(new URL('../apps/mobile/dist',import.meta.url)),files=[],hash=createHash('sha256');
async function walk(dir){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(!['sw.js','metadata.json','precache.js'].includes(item.name)){files.push('/'+relative(root,path).replaceAll('\\','/'));hash.update(await readFile(path));}}}
await walk(root);
hash.update(await readFile(join(root,'sw.js')));
await writeFile(join(root,'precache.js'),'self.AGRI_BUILD='+JSON.stringify(hash.digest('hex').slice(0,16))+';self.AGRI_PRECACHE='+JSON.stringify(['/',...files])+';');
console.log('Offline shell prepared: '+files.length+' assets.');
