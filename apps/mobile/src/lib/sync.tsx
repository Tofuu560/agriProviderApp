import React,{createContext,useContext,useEffect,useState,useRef} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState,Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { localGet,localSet } from './local-store';
import { useSession } from './session';
import { request,ApiError } from './api';
export type QueueItem={id:string,path:string,body:any,label:string,status:'Pending'|'Syncing'|'Failed',error?:string,attempts:number,nextAttemptAt?:number};
const locks=new Map<string,Promise<unknown>>();
async function updateQueue(owner:string,change:(items:QueueItem[])=>QueueItem[]){
 const previous=locks.get(owner)??Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{const items=await localGet<QueueItem[]>(owner,'queue')??[];const next=change(items);await localSet(owner,'queue',next);return next;});
 locks.set(owner,task);return task;
}
const Context=createContext<{items:QueueItem[],online:boolean,enqueue:(path:string,body:any,label:string)=>Promise<void>,sync:()=>Promise<void>,retry:(id:string)=>Promise<void>}>(null!);
export function SyncProvider({children}:{children:React.ReactNode}){
 const {user}=useSession(),query=useQueryClient();const [items,setItems]=useState<QueueItem[]>([]),[online,setOnline]=useState(true);
 const busy=useRef(false),userRef=useRef(user);userRef.current=user;
 async function change(owner:string,fn:(items:QueueItem[])=>QueueItem[]){const next=await updateQueue(owner,fn);if(userRef.current?.id===owner)setItems(next);return next;}
 async function sync(){
  const owner=userRef.current?.id;if(!owner||busy.current)return;busy.current=true;
  try{
   const snapshot=await localGet<QueueItem[]>(owner,'queue')??[];
   for(const original of snapshot){
    if(userRef.current?.id!==owner)break;
    if(original.status==='Failed'&&(original.attempts>=5||(original.nextAttemptAt??0)>Date.now()))continue;
    await change(owner,items=>items.map(i=>i.id===original.id?{...i,status:'Syncing'}:i));
    try{
     let body=original.body;
     if(body.upload){const form=new FormData();form.append('metadata',JSON.stringify(body.metadata));if(Platform.OS==='web')form.append('file',body.file.blob,body.file.name);else form.append('file',{uri:body.file.uri,name:body.file.name,type:body.file.mime} as any);body=form;}
     if(userRef.current?.id!==owner)break;
     await request(original.path,body,undefined,true,owner);
     await change(owner,items=>items.filter(i=>i.id!==original.id));
    }catch(e){
     const error=e as ApiError;await change(owner,items=>items.map(i=>i.id===original.id?{...i,status:'Failed',attempts:i.attempts+1,error:error.message,nextAttemptAt:Date.now()+Math.min(300000,1000*2**i.attempts)+Math.random()*1000}:i));
     if(error.status===401||error.status===403||error.status===409||error.status===0)break;
    }
   }
   await query.invalidateQueries();
  }finally{busy.current=false;}
 }
 useEffect(()=>{setItems([]);if(user){const owner=user.id;localGet<QueueItem[]>(owner,'queue').then(v=>{if(userRef.current?.id===owner)setItems(v??[]);});}},[user?.id]);
 useEffect(()=>{const unsub=NetInfo.addEventListener(state=>{const connected=state.isConnected!==false&&state.isInternetReachable!==false;setOnline(connected);if(connected)void sync();});const a=AppState.addEventListener('change',s=>{if(s==='active')void sync();});return()=>{unsub();a.remove();};},[user?.id]);
 useEffect(()=>{if(!online||!user)return;const timer=setInterval(()=>void sync(),15000);return()=>clearInterval(timer);},[online,user?.id]);
 async function enqueue(path:string,body:any,label:string){if(!user)throw new Error('Sign in first.');const owner=user.id;const item={id:body.clientOpId??body.metadata?.clientOpId??Crypto.randomUUID(),path,body,label,status:'Pending' as const,attempts:0};await change(owner,items=>items.some(i=>i.id===item.id)?items:[...items,item]);if(online)void sync();}
 async function retry(id:string){if(!user)return;await change(user.id,items=>items.map(i=>i.id===id?{...i,attempts:0,nextAttemptAt:0,status:'Pending'}:i));await sync();}
 return <Context.Provider value={{items,online,enqueue,sync,retry}}>{children}</Context.Provider>;
}
export const useSync=()=>useContext(Context);
