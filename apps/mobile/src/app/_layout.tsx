import React,{Component,useEffect} from 'react';import { Platform } from 'react-native';import { useFonts,Inter_400Regular,Inter_600SemiBold,Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { SyncProvider } from '../lib/sync';
import { Page,Body,Button } from '../components/ui';
const queryClient=new QueryClient();
class Boundary extends Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<Page title="Something went wrong"><Body>Your saved work is still on this device.</Body><Button title="Try again" onPress={()=>this.setState({failed:false})}/></Page>:this.props.children;}}
export default function Root(){const [fontsLoaded,fontError]=useFonts({Inter:Inter_400Regular,InterSemiBold:Inter_600SemiBold,InterBold:Inter_700Bold});useEffect(()=>{if(Platform.OS==='web'&&typeof document!=='undefined'){if(!document.querySelector('link[rel=manifest]')){const link=document.createElement('link');link.rel='manifest';link.href='/manifest.json';document.head.appendChild(link);}if(!__DEV__&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}},[]);if(!fontsLoaded&&!fontError)return null;return <SafeAreaProvider><Boundary><QueryClientProvider client={queryClient}><SessionProvider><SyncProvider><Stack screenOptions={{headerShown:false}}/></SyncProvider></SessionProvider></QueryClientProvider></Boundary></SafeAreaProvider>;}
