import React from 'react';
import {ScrollView,View,Text} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {theme as t} from '../lib/theme';
import {Body} from './ui';
export function AuthShell({title,subtitle,children}:{title:string,subtitle:string,children:React.ReactNode}){
 return <ScrollView style={{flex:1,backgroundColor:t.background}} contentContainerStyle={{flexGrow:1,padding:24,justifyContent:'center'}} keyboardShouldPersistTaps="handled"><View style={{width:'100%',maxWidth:420,alignSelf:'center',gap:20,paddingVertical:20}}>
 <View style={{gap:6}}><Text style={{fontFamily:'InterBold',color:t.primary,fontSize:12,letterSpacing:1.6}}>AGRIPROVIDER</Text><Body muted>Secure access</Body></View>
 <View style={{width:54,height:54,backgroundColor:t.primary,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:12}}><Text style={{fontFamily:'InterBold',fontSize:32,color:'white'}}>A</Text></View>
 <View style={{gap:8}}><Text accessibilityRole="header" style={{fontFamily:'InterBold',fontSize:30,color:t.primary,letterSpacing:-0.7}}>{title}</Text><Body muted>{subtitle}</Body></View>{children}
 <View style={{flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center',paddingTop:24}}><Feather name="lock" color={t.muted} size={15}/><Body muted>Secured by Identity Service</Body></View>
 </View></ScrollView>;
}
