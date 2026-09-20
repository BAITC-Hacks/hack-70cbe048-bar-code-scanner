import type {City} from './types.js';
export const cityIds:Record<City,number>={astana:2,almaty:1};
export function isCity(value:string): value is City { return value==='astana'||value==='almaty'; }
export function validEan(ean:string):boolean { if(!/^\d+$/.test(ean)||![8,12,13,14].includes(ean.length)||/^0+$/.test(ean)) return false; if(ean.length===14) return true; const body=ean.slice(0,-1), check=Number(ean.at(-1)); let sum=0; for(let i=body.length-1;i>=0;i--) sum+=Number(body[i])*( (body.length-i)%2===1 ? 3:1); return (10-sum%10)%10===check; }
