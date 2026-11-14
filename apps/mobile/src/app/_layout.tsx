import React,{Component,useEffect,useState} from 'react';import { Platform } from 'react-native';import { useFonts,Inter_400Regular,Inter_600SemiBold,Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { SyncProvider } from '../lib/sync';
import { Page,Body,Button } from '../components/ui';

if(typeof (globalThis as any).ErrorUtils!=='undefined'){
 const orig=(globalThis as any).ErrorUtils.getGlobalHandler?.();
 (globalThis as any).ErrorUtils.setGlobalHandler((err:any,isFatal?:boolean)=>{
  console.warn('Caught global JS error:',err);
  if(__DEV__&&orig)orig(err,isFatal);
 });
}

const queryClient=new QueryClient();
class Boundary extends Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<Page title="Something went wrong"><Body>Your saved work is still on this device.</Body><Button title="Try again" onPress={()=>this.setState({failed:false})}/></Page>:this.props.children;}}
export default function Root(){
 const [fontsLoaded,fontError]=useFonts({Inter:Inter_400Regular,InterSemiBold:Inter_600SemiBold,InterBold:Inter_700Bold});
 const [fontTimeout,setFontTimeout]=useState(false);
 useEffect(()=>{const t=setTimeout(()=>setFontTimeout(true),2500);return()=>clearTimeout(t);},[]);
 useEffect(()=>{if(Platform.OS==='web'&&typeof document!=='undefined'){if(!document.querySelector('link[rel=manifest]')){const link=document.createElement('link');link.rel='manifest';link.href='/manifest.json';document.head.appendChild(link);}if(!__DEV__&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}},[]);
 if(!fontsLoaded&&!fontError&&!fontTimeout)return null;
 return <SafeAreaProvider><Boundary><QueryClientProvider client={queryClient}><SessionProvider><SyncProvider><Stack screenOptions={{headerShown:false}}/></SyncProvider></SessionProvider></QueryClientProvider></Boundary></SafeAreaProvider>;
}
