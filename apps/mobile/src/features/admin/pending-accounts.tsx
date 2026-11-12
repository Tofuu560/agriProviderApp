import {DateField} from '../../components/DateField';
import {sastIso} from '../../lib/dates';
import React,{useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Page,Card,Heading,Body,Field,Button,Chip,Row,QueryState,Check,useAction} from '../../components/ui';
import {useData} from '../../lib/data';
import {request} from '../../lib/api';
function Application({account:u}:{account:any}){
 const [reason,setReason]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[verified,setVerified]=useState(false),a=useAction(),cache=useQueryClient();
 async function decide(approve:boolean){await a.run(async()=>{await request('/admin/pending-accounts/'+u.id,{approve,...(!approve?{reason}:{}),...(approve&&u.role==='PROVIDER'?{validFrom:sastIso(from),validTo:sastIso(to,true)}:{})});await cache.invalidateQueries();},approve?'Account approved.':'Account rejected.');}
 return <Card><Row><Heading>{u.fullName}</Heading><Chip tone="amber">Pending</Chip></Row><Body>{u.email}</Body><Body muted>{u.role.replaceAll('_',' ')} · {u.requestedOrganisation}</Body><Body muted>Requested {new Date(u.createdAt).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</Body>
 {u.provider&&<><Body>Accreditation: {u.provider.accreditationNumber} · {u.provider.province}</Body><DateField label="Accreditation valid from" value={from} onChange={setFrom}/><DateField label="Accreditation valid to" value={to} onChange={setTo}/></>}
 <Check label="I have verified this applicant's identity, role and organisation." value={verified} onChange={setVerified}/><Field label="Rejection reason" value={reason} onChangeText={setReason} placeholder="At least 10 characters"/>{a.feedback}<Row><Button title="Approve account" disabled={a.busy||!verified||(!!u.provider&&(!from||!to))} onPress={()=>void decide(true)}/><Button title="Reject account" variant="danger" disabled={a.busy||reason.trim().length<10} onPress={()=>void decide(false)}/></Row></Card>;
}
export default function PendingAccounts(){const q=useData('/admin/pending-accounts');return <Page title="Pending accounts" subtitle="Review access requests before granting a workspace."><QueryState query={q}>{rows=><>{!rows.length&&<Card><Heading>All caught up</Heading><Body muted>No accounts are waiting for approval.</Body></Card>}{rows.map((u:any)=><Application key={u.id} account={u}/>)}</>}</QueryState></Page>;}
