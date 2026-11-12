import React from 'react';
import {countries,provinces,phonePrefix} from '@agri/shared';
import {Choice} from './Choice';
import {Field} from './ui';
export function LocationFields({country,province,phone,onChange}:{country:string,province:string,phone:string,onChange:(v:{country:string,province:string,phone:string})=>void}){
 const other=country!=='ZA',states=provinces(country);
 return <><Choice label="Province" value={other?'OTHER':province} options={[...provinces('ZA').map(value=>({value,label:value})),{value:'OTHER',label:'Other country'}]} onChange={v=>onChange(v==='OTHER'?{country:'',province:'',phone:'+'}:{country:'ZA',province:v,phone:other?'+27':phone})}/>{other&&<><Choice label="Country" value={country} options={countries.filter(c=>c.value!=='ZA')} onChange={v=>onChange({country:v,province:'',phone:phonePrefix(v)})}/>{country&&(states.length?<Choice label="Province / State" value={province} options={states.map(value=>({value,label:value}))} onChange={v=>onChange({country,province:v,phone})}/>:<Field label="Province / Region" value={province} onChangeText={v=>onChange({country,province:v,phone})}/>)}</>}<Field label="Phone number" value={phone} keyboardType="phone-pad" onChangeText={v=>onChange({country,province,phone:v})}/></>;
}
