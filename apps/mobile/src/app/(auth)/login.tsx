import React,{useState} from 'react';
import {Platform,View,Text} from 'react-native';
import {Redirect,router} from 'expo-router';
import {landing} from '@agri/shared';
import {Field,Button,Body,Banner,useAction,Check,Heading} from '../../components/ui';
import {AuthShell} from '../../components/AuthShell';
import {MfaSetup} from '../../components/MfaSetup';
import {useSession} from '../../lib/session';
import {request,ApiError} from '../../lib/api';
export default function Login(){
 const {user,ready,accept}=useSession(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[show,setShow]=useState(false),[challenge,setChallenge]=useState<any>(null),[completed,setCompleted]=useState<any>(null),a=useAction();
 const transport=Platform.OS==='web'?'web':'native';
 if(ready&&user)return <Redirect href={landing[user.role] as any}/>;
 if(completed)return <AuthShell title="Save your recovery codes" subtitle="Keep these private. Each code can be used once if you lose your authenticator."><View style={{gap:10}}>{completed.recoveryCodes.map((c:string)=><Text selectable key={c}>{c}</Text>)}</View><Button title="I saved my codes — continue" onPress={()=>void a.run(()=>accept(completed),'')}/>{a.feedback}</AuthShell>;
 if(challenge)return <AuthShell title="Protect your account" subtitle="Your role requires multi-factor authentication."><MfaSetup info={challenge}/><Field label="Authenticator code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}/>{a.feedback}<Button title="Verify authenticator" disabled={a.busy||code.length!==6} onPress={()=>void a.run(async()=>setCompleted(await request('/auth/mfa/complete',{setupToken:challenge.setupToken,code,transport})),'')}/><Button title="Back to sign in" variant="secondary" onPress={()=>{setChallenge(null);setCode('');}}/></AuthShell>;
 return <AuthShell title="AgriProvider" subtitle="Your work. One secure workspace.">
 <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@organisation.co.za"/>
 <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" placeholder="Enter your password"/>
 <Check label="Show password" value={show} onChange={setShow}/>
 <Field label="Authenticator or recovery code (if enabled)" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={64} placeholder="Leave blank unless MFA is enabled"/>
 {a.feedback}<Button title={a.busy?'Signing in…':'Sign in'} disabled={a.busy||!email||!password} onPress={()=>void a.run(async()=>{
 try{const data=await request('/auth/login',{email:email.trim(),password,...(code?{code}:{}),transport});if(data.mfaSetupRequired){setChallenge(data);setCode('');}else await accept(data);}
 catch(e){if(e instanceof ApiError&&e.code==='ACCOUNT_PENDING')router.replace('/(auth)/pending');else throw e;}
 },'')}/>
 <Button title="Forgot password?" variant="secondary" onPress={()=>router.push('/(auth)/forgot-password')}/>
 <Banner>Your workspace is assigned securely from your login credentials.</Banner>
 <Heading>New to AgriProvider?</Heading><Body muted>Providers, assessors and QA officers can request an account. Learners receive access from their training provider.</Body>
 <Button title="Create account" variant="secondary" onPress={()=>router.push('/(auth)/signup')}/></AuthShell>;
}
