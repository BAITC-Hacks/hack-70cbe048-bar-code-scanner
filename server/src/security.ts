import type {RequestHandler} from 'express';
import {timingSafeEqual} from 'node:crypto';
export const adminAuth: RequestHandler = (req,res,next) => {
 const token=process.env.ADMIN_TOKEN;
 if(!token) {res.status(503).json({code:'ADMIN_DISABLED'});return;}
 const provided=req.headers.authorization?.replace(/^Bearer /,'') ?? '';
 const a=Buffer.from(token), b=Buffer.from(provided);
 if(a.length!==b.length || !timingSafeEqual(a,b)) {res.status(401).json({code:'UNAUTHORIZED'});return;}
 next();
};
export function rateLimit(max:number,windowMs=60000):RequestHandler {
 const hits=new Map<string,{count:number;until:number}>();
 return (req,res,next)=>{
  const now=Date.now(), key=req.ip ?? req.socket.remoteAddress ?? 'unknown';
  for(const [k,v] of hits) if(v.until<=now) hits.delete(k);
  const value=hits.get(key) ?? {count:0,until:now+windowMs};
  value.count++;hits.set(key,value);
  if(value.count>max){res.setHeader('Retry-After',String(Math.ceil((value.until-now)/1000)));res.status(429).json({code:'RATE_LIMITED',message:'Слишком много запросов. Подождите минуту.'});return;}
  next();
 };
}
