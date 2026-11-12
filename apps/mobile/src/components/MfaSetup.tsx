import React from 'react';
import {Image,View,Text} from 'react-native';
import {Body,Heading} from './ui';
export function MfaSetup({info}:{info:{qrDataUrl?:string,secret?:string}}){return <View style={{gap:12}}><Heading>Set up your authenticator</Heading><Body muted>In Microsoft or Google Authenticator, add an account and scan this QR code. Then enter the six-digit code below.</Body>{info.qrDataUrl&&<Image accessibilityLabel="Authenticator setup QR code" source={{uri:info.qrDataUrl}} style={{width:260,height:260,maxWidth:'100%',alignSelf:'center',backgroundColor:'white'}} resizeMode="contain"/>}<Body muted>On the same phone? Enter this setup key manually:</Body><Text selectable style={{fontFamily:'InterSemiBold',fontSize:16,textAlign:'center'}}>{info.secret}</Text></View>;}
