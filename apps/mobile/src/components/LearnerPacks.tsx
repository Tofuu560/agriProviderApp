import React,{useState} from 'react';
import {Platform,Linking} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import {useQueryClient} from '@tanstack/react-query';
import {evidenceLabels,evidenceTypes} from '@agri/shared';
import {Card,Heading,Body,Button,Field,Check,QueryState,Banner,useAction} from './ui';
import {Choice} from './Choice';
import {useData} from '../lib/data';
import {useSync} from '../lib/sync';
import {useSession} from '../lib/session';
import {request,API} from '../lib/api';
import {formatSast} from '../lib/dates';
const label=(type:string)=>evidenceLabels[type]??'Supporting document';
function Pack({pack:p,role,cohortId}:{pack:any,role:string,cohortId:string}){
 const [type,setType]=useState('ID_DOCUMENTS'),[signed,setSigned]=useState(false),[signer,setSigner]=useState(''),[reason,setReason]=useState('');
 const a=useAction(),cache=useQueryClient(),{enqueue,items,sync}=useSync(),{user}=useSession();
 const base='/'+role+'/cohorts/'+cohortId+'/learner-packs/'+p.learnerId;
 async function act(action:string){await request(base+'/submit',{action,...(reason.trim()?{reason:reason.trim()}:{})});await cache.invalidateQueries();}
 async function upload(){
  const r=await DocumentPicker.getDocumentAsync({type:type==='CERTIFICATES'&&p.allowAnyCertificateFile?'*/*':['application/pdf','image/jpeg','image/png'],copyToCacheDirectory:true});if(r.canceled)return;
  const file=r.assets[0];if((file.size??0)>10*1024*1024)throw new Error('Maximum file size is 10 MB.');
  const metadata={type,signed:type==='CERTIFICATES'&&signed,...(type==='CERTIFICATES'?{signerName:signer}:{}),clientOpId:Crypto.randomUUID()};
  let stored:any;
  if(Platform.OS==='web')stored={blob:await(await fetch(file.uri)).blob(),name:file.name};
  else{const {File,Directory,Paths}=await import('expo-file-system');const dir=new Directory(Paths.document,'documents-'+user!.id);dir.create({idempotent:true,intermediates:true});const target=new File(dir,metadata.clientOpId);new File(file.uri).copy(target);stored={uri:target.uri,name:file.name,mime:file.mimeType??'application/octet-stream'};}
  await enqueue(base+'/files',{upload:true,metadata,file:stored},p.fullName+' · '+label(type));await cache.invalidateQueries();
 }
 const queue=items.filter(i=>i.path===base+'/files');
 return <Card><Heading>{p.fullName}</Heading><Body>Pack: {p.status.replaceAll('_',' ')}</Body>{p.reason&&<Banner tone="amber">Reviewer message: {p.reason}</Banner>}
 {p.items?.map((i:any)=><Body key={i.type}>{label(i.type)}: {i.notRequired?'Not required':i.status}</Body>)}
 {['learner','provider'].includes(role)&&<><Choice label="Document type" value={type} onChange={setType} options={(role==='learner'?['ID_DOCUMENTS','CONSENT_FORMS','SUPPORTING_DOCUMENT']:[...evidenceTypes.filter(t=>t!=='ASSESSOR_REPORT'),'SUPPORTING_DOCUMENT']).map(value=>({value,label:label(value)}))}/>{type==='CERTIFICATES'&&<><Check label="The certificate is signed" value={signed} onChange={setSigned}/><Field label="Signer name" value={signer} onChangeText={setSigner}/>{p.allowAnyCertificateFile&&<Body muted>Testing: any certificate file type is accepted.</Body>}</>}<Button title="Upload document" disabled={a.busy} onPress={()=>void a.run(upload,'Document saved to your upload queue. Earlier files are kept.')}/>{queue.map(i=><Banner key={i.id} tone={i.status==='Failed'?'red':'amber'}>{i.label}: {i.status} {i.error??''}</Banner>)}{!!queue.length&&<Button title="Sync documents" onPress={()=>void sync()}/>}</>}
 <Heading>Document history</Heading>{!p.files.length&&<Body muted>No individual documents uploaded yet.</Body>}{p.files.map((f:any)=><Card key={f.id}><Body>{label(f.type)} · {f.fileName}</Body><Body muted>{formatSast(f.createdAt)} · {f.status}</Body><Button title={'Open '+f.fileName} variant="secondary" onPress={()=>void a.run(async()=>{const r=await request('/'+role+'/evidence/'+f.id+'/download');await Linking.openURL(r.url.startsWith('/')?API+r.url:r.url);},'')}/></Card>)}
 {role==='provider'&&<Button title="Submit this learner to assessor" disabled={a.busy||!!queue.length} onPress={()=>void a.run(()=>act('SUBMIT'),'Learner pack sent to the assigned assessor.')}/>}
 {role==='assessor'&&<Button title="Approve and send this learner to QA" disabled={a.busy||p.status!=='ASSESSOR_REVIEW'} onPress={()=>void a.run(()=>act('APPROVE'),'This learner pack is now in QA review.')}/>}
 {role==='qa'&&<Button title="Verify this learner pack" disabled={a.busy||p.status!=='QA_REVIEW'} onPress={()=>void a.run(()=>act('APPROVE'),'Learner pack verified.')}/>}
 {['assessor','qa'].includes(role)&&<><Field label={'Message for '+p.fullName} value={reason} onChangeText={setReason} multiline/><Button title="Reject / Request Re-upload" variant="danger" disabled={!reason.trim()} onPress={()=>{if(!a.busy)void a.run(()=>act('REQUEST_CHANGES'),'Provider notified. Earlier documents remain in history.');}}/></>}{a.feedback}
 </Card>;
}
export function LearnerPacks({cohortId,role,initialLearnerId}:{cohortId:string,role:'learner'|'provider'|'assessor'|'qa',initialLearnerId?:string}){
 const q=useData('/'+role+'/cohorts/'+cohortId+'/learner-packs'),[selected,setSelected]=useState(initialLearnerId??'');
 return <QueryState query={q}>{rows=>{const p=rows.find((x:any)=>x.learnerId===selected)??rows[0];return <><Heading>{role==='learner'?'My documents':'Individual learner evidence packs'}</Heading>{role!=='learner'&&<Choice label="Select learner" value={p?.learnerId??''} onChange={setSelected} options={rows.map((x:any)=>({value:x.learnerId,label:x.fullName+' · '+x.status.replaceAll('_',' ')}))}/>} {p?<Pack key={p.learnerId} pack={p} role={role} cohortId={cohortId}/>:<Body>No learners enrolled.</Body>}</>;}}</QueryState>;
}
