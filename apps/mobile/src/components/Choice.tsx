import React,{useState} from 'react';
import {Platform,View,Text,Modal,ScrollView} from 'react-native';
import {Button,Field} from './ui';
export function Choice({label,value,options,onChange}:{label:string,value:string,options:{value:string,label:string}[],onChange:(v:string)=>void}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 if(Platform.OS==='web')return <View style={{gap:8}}><Text>{label}</Text><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} style={{padding:13,border:'1px solid #CBD5CD',borderRadius:8,fontSize:16,background:'white',width:'100%'}}><option value="">Select…</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></View>;
 return <View style={{gap:8}}><Text>{label}</Text><Button title={options.find(o=>o.value===value)?.label??'Select '+label} variant="secondary" onPress={()=>setOpen(true)}/><Modal visible={open} onRequestClose={()=>setOpen(false)}><View style={{padding:24,flex:1,gap:12}}><Field label={'Search '+label} value={search} onChangeText={setSearch}/><Button title="Close selection" onPress={()=>setOpen(false)}/><ScrollView>{options.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())).map(o=><Button key={o.value} title={o.label} variant="secondary" onPress={()=>{onChange(o.value);setOpen(false);setSearch('');}}/>)}</ScrollView></View></Modal></View>;
}
