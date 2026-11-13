import { Platform } from 'react-native';
import Constants from 'expo-constants';
const host=Constants.expoConfig?.hostUri?.split(':')[0]??'localhost';
export const API=process.env.EXPO_PUBLIC_API_URL??(Platform.OS==='web'?'http://'+(typeof window!=='undefined'?window.location.hostname:'localhost')+':4000':'http://'+host+':4000');
let accessToken:string|null=null;let identity:string|null=null;
let refreshHandler:(()=>Promise<void>)|null=null;
let refreshing:Promise<void>|null=null;
export function setAccessToken(value:string|null,userId?:string){accessToken=value;identity=value?(userId??identity):null;}
export function setRefreshHandler(fn:(()=>Promise<void>)|null){refreshHandler=fn;}
export class ApiError extends Error {constructor(public code:string,message:string,public status:number,public fields:any[]=[]){super(message);}}
export async function request<T=any>(path:string,body?:unknown,method?:string,retry=true,owner?:string):Promise<T>{
 if(owner&&identity!==owner)throw new ApiError('ACCOUNT_CHANGED','Sign in to the original account to sync these items.',401);
 let response:Response;
 try{response=await fetch(API+'/api/v1'+path,{method:method??(body===undefined?'GET':'POST'),credentials:'include',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(accessToken?{Authorization:'Bearer '+accessToken}:{})},...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});}
 catch{throw new ApiError('NETWORK','Unable to reach the server. Your saved work remains on this device.',0);}
 if(response.status===401&&retry&&refreshHandler&&!path.startsWith('/auth/')){
  try{if(!refreshing)refreshing=refreshHandler().finally(()=>{refreshing=null;});await refreshing;return request(path,body,method,false,owner);}catch{throw new ApiError('SESSION_EXPIRED','Please sign in again. Your saved work is kept safely.',401);}
 }
 let json:any;
 try{json=await response.json();}
 catch{
  if(!response.ok)throw new ApiError('HTTP_'+response.status,'Server response: '+response.statusText+' ('+response.status+').',response.status);
  json={};
 }
 if(!response.ok)throw new ApiError(json.code??'ERROR',json.message??'Please try again.',response.status,json.fields);
 return json;
}
