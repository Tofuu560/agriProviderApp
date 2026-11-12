import { Platform } from 'react-native';
type Entry={key:string,value:any};
const nativeDbs=new Map<string,any>();
async function native(userId:string){if(!nativeDbs.has(userId)){const SQLite=await import('expo-sqlite');const db=await SQLite.openDatabaseAsync('agri-'+userId+'.db');await db.execAsync('CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');nativeDbs.set(userId,db);}return nativeDbs.get(userId);}
async function web(userId:string):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('agri-'+userId,1);r.onupgradeneeded=()=>r.result.createObjectStore('store',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function localGet<T>(userId:string,key:string):Promise<T|null>{
 if(Platform.OS!=='web'){const row=await (await native(userId)).getFirstAsync('SELECT value FROM store WHERE key=?',key);return row?JSON.parse(row.value):null;}
 const db=await web(userId);return new Promise((resolve,reject)=>{const tx=db.transaction('store','readonly');const r=tx.objectStore('store').get(key);r.onsuccess=()=>resolve((r.result as Entry)?.value??null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});
}
export async function localSet(userId:string,key:string,value:unknown){
 if(Platform.OS!=='web'){await (await native(userId)).runAsync('INSERT OR REPLACE INTO store(key,value) VALUES(?,?)',key,JSON.stringify(value));return;}
 const db=await web(userId);return new Promise<void>((resolve,reject)=>{const tx=db.transaction('store','readwrite');tx.objectStore('store').put({key,value});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);});
}
export async function lockStore(userId:string){const db=nativeDbs.get(userId);if(db){await db.closeAsync();nativeDbs.delete(userId);}}
