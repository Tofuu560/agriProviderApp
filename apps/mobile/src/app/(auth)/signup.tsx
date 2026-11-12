import {LocationFields} from '../../components/LocationFields';
import React,{useState} from 'react';
import {router,Redirect} from 'expo-router';
import {signupSchema,landing} from '@agri/shared';
import {AuthShell} from '../../components/AuthShell';
import {Field,Select,Button,Body,Check,useAction} from '../../components/ui';
import {request} from '../../lib/api';
import {useSession} from '../../lib/session';
export default function Signup(){
 const {user}=useSession(),[role,setRole]=useState('PROVIDER'),[fullName,setName]=useState(''),[email,setEmail]=useState(''),[organisation,setOrg]=useState(''),[accreditationNumber,setAcc]=useState(''),[location,setLocation]=useState({country:'ZA',province:'',phone:'+27'}),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[consent,setConsent]=useState(false),a=useAction();
 if(user)return <Redirect href={landing[user.role] as any}/>;
 return <AuthShell title="Create your account" subtitle="Request access. An administrator will review your application before you can sign in.">
 <Select label="I am a" value={role} onChange={setRole} options={[{value:'PROVIDER',label:'Training Provider'},{value:'ASSESSOR',label:'Assessor'},{value:'QA_OFFICER',label:'QA Officer'}]}/>
 <Field label="Full name" value={fullName} onChangeText={setName}/><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/>
 <Field label="Organisation" value={organisation} onChangeText={setOrg}/>
 {role==='PROVIDER'&&<><Field label="Accreditation number" value={accreditationNumber} onChangeText={setAcc}/></>}
 <LocationFields {...location} onChange={setLocation}/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"/><Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none"/>
 <Body muted>Use at least 12 characters. Avoid your name and email.</Body><Check label="I confirm these details are correct and may be reviewed for account approval." value={consent} onChange={setConsent}/>{a.feedback}
 <Button title={a.busy?'Submitting…':'Request account'} disabled={a.busy||!consent} onPress={()=>void a.run(async()=>{if(!location.province||!location.phone)throw new Error('Select your location and enter your phone number.');if(password!==confirm)throw new Error('Passwords do not match.');const result=signupSchema.safeParse({role,fullName,email,password,organisation,...location,...(role==='PROVIDER'?{accreditationNumber}:{})});if(!result.success)throw new Error(result.error.issues[0].message);await request('/auth/signup',result.data);router.replace('/(auth)/pending');},'')}/>
 <Button title="Back to sign in" variant="secondary" onPress={()=>router.replace('/(auth)/login')}/></AuthShell>;
}
