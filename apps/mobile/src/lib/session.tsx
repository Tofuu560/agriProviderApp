import React,{createContext,useContext,useState,useEffect} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { request,setAccessToken,setRefreshHandler,ApiError } from './api';
import { lockStore } from './local-store';
import {enableBackgroundSync} from './background';
import type { Role } from '@agri/shared';
type User={id:string,email:string,fullName:string,role:Role,providerId:string|null,mfaEnabled:boolean};
type Session={user:User|null,ready:boolean,accept:(data:any)=>Promise<void>,logout:()=>Promise<void>};
const Context=createContext<Session>(null!);
async function savedProfile(value?:User|null):Promise<User|null>{
 try{
  if(Platform.OS==='web'){if(typeof sessionStorage==='undefined')return null;if(value!==undefined){if(value)sessionStorage.setItem('agri-profile',JSON.stringify(value));else sessionStorage.removeItem('agri-profile');}const raw=sessionStorage.getItem('agri-profile');return raw?JSON.parse(raw):null;}
  if(value!==undefined){if(value)await SecureStore.setItemAsync('agri-profile',JSON.stringify(value));else await SecureStore.deleteItemAsync('agri-profile');}const raw=await SecureStore.getItemAsync('agri-profile');return raw?JSON.parse(raw):null;
 }catch{return null;}
}
export function SessionProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
 async function accept(data:any){if(Platform.OS==='web')localStorage.removeItem('agri-signed-out');setAccessToken(data.accessToken,data.user.id);setUser(data.user);await savedProfile(data.user);void enableBackgroundSync().catch(()=>{});if(Platform.OS!=='web'&&data.refreshToken)await SecureStore.setItemAsync('agri-refresh',data.refreshToken);}
 // Persist only the sign-out flag across tabs; credentials remain in the HTTP-only cookie.
 async function refresh(){
  if(Platform.OS==='web'&&localStorage.getItem('agri-signed-out'))throw new ApiError('SESSION_EXPIRED','Please sign in again.',401);
  const refreshToken=Platform.OS==='web'?undefined:await SecureStore.getItemAsync('agri-refresh').catch(()=>null);
  if(Platform.OS!=='web'&&!refreshToken){setUser(null);return;}
  try{const data=await request('/auth/refresh',{transport:Platform.OS==='web'?'web':'native',...(refreshToken?{refreshToken}:{})},'POST',false);await accept(data);}catch(e){if(e instanceof ApiError&&e.status===401){setUser(null);setAccessToken(null);await savedProfile(null);}throw e;}
 }
 useEffect(()=>{setRefreshHandler(refresh);if(Platform.OS==='web'&&localStorage.getItem('agri-signed-out')){setReady(true);return()=>setRefreshHandler(null);}refresh().catch(async e=>{if(e instanceof ApiError&&(e.status===0||e.status>=400))setUser(await savedProfile());}).finally(()=>setReady(true));return()=>setRefreshHandler(null);},[]);
 async function logout(){if(Platform.OS==='web')localStorage.setItem('agri-signed-out','true');try{await request('/auth/logout',{});}catch{/* Server token expires even when an offline logout cannot be delivered. */}setAccessToken(null);if(user)await lockStore(user.id);setUser(null);await savedProfile(null);if(Platform.OS!=='web')await SecureStore.deleteItemAsync('agri-refresh');}
 return <Context.Provider value={{user,ready,accept,logout}}>{children}</Context.Provider>;
}
export const useSession=()=>useContext(Context);
