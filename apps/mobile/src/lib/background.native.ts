import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { localGet,localSet } from './local-store';
import { API } from './api';
const NAME='agriprovider-offline-sync';
TaskManager.defineTask(NAME,async()=>{
 if(AppState.currentState==='active')return BackgroundTask.BackgroundTaskResult.Success;
 try{
  const raw=await SecureStore.getItemAsync('agri-profile'),refreshToken=await SecureStore.getItemAsync('agri-refresh');
  if(!raw||!refreshToken)return BackgroundTask.BackgroundTaskResult.Success;
  const user=JSON.parse(raw),items=await localGet<any[]>(user.id,'queue')??[];
  if(!items.length)return BackgroundTask.BackgroundTaskResult.Success;
  const response=await fetch(API+'/api/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken,transport:'native'}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)return BackgroundTask.BackgroundTaskResult.Failed;
  const session=await response.json();if(session.user.id!==user.id)return BackgroundTask.BackgroundTaskResult.Failed;
  await SecureStore.setItemAsync('agri-refresh',session.refreshToken);
  for(const item of items){
   if(AppState.currentState==='active'||await SecureStore.getItemAsync('agri-profile')!==raw)break;
   let body=item.body,headers:any={Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'};
   if(body.upload){const form=new FormData();form.append('metadata',JSON.stringify(body.metadata));form.append('file',{uri:body.file.uri,name:body.file.name,type:body.file.mime} as any);body=form;headers={Authorization:'Bearer '+session.accessToken};}
   const result=await fetch(API+'/api/v1'+item.path,{method:'POST',headers,body:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
   if(!result.ok)break;
   const latest=await localGet<any[]>(user.id,'queue')??[];
   await localSet(user.id,'queue',latest.filter(i=>i.id!==item.id));
  }
  return BackgroundTask.BackgroundTaskResult.Success;
 }catch{return BackgroundTask.BackgroundTaskResult.Failed;}
});
export async function enableBackgroundSync(){
 if(!await TaskManager.isAvailableAsync())return false;
 if(!await TaskManager.isTaskRegisteredAsync(NAME))await BackgroundTask.registerTaskAsync(NAME,{minimumInterval:15});
 return true;
}
