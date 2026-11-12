import { useQuery } from '@tanstack/react-query';
import { request,ApiError } from './api';
import { localGet,localSet } from './local-store';
import { useSession } from './session';
export function useData<T=any>(path:string){
 const {user}=useSession();
 return useQuery<T>({queryKey:[user?.id,path],enabled:!!user,queryFn:async()=>{
  try{const data=await request<T>(path);await localSet(user!.id,'cache:'+path,data);return data;}
  catch(e){if(e instanceof ApiError&&e.status===0){const cached=await localGet<T>(user!.id,'cache:'+path);if(cached)return cached;}throw e;}
 },retry:1,staleTime:15000});
}
