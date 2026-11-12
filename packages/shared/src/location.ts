import Country from 'country-state-city/lib/cjs/country';
import State from 'country-state-city/lib/cjs/state';
import {parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js/max';
export const saProvinces=['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];
export const countries=Country.getAllCountries().map(c=>({value:c.isoCode,label:c.name,callingCode:'+'+c.phonecode}));
export function provinces(country:string){return country==='ZA'?saProvinces:State.getStatesOfCountry(country).map(s=>s.name);}
export function validLocation(country:string,province?:string){const states=provinces(country);return countries.some(c=>c.value===country)&&!!province&&(states.length?states.includes(province):province.trim().length>=2);}
export function validPhone(phone:string,country:string){const n=parsePhoneNumberFromString(phone,country as CountryCode);return !!n&&n.isValid()&&n.country===country;}
export function phonePrefix(country:string){return countries.find(c=>c.value===country)?.callingCode??'+';}
