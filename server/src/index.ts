import express from 'express';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createApp} from './app.js';
import {createDb} from './db.js';

const port=Number(process.env.PORT||3000);
const db=createDb();
const app=createApp(db);
app.get('/api/health',(_req,res)=>res.json({status:'ok'}));
app.use('/api',(_req,res)=>res.status(404).json({status:'not_found'}));
const webRoot=fileURLToPath(new URL('../web/',import.meta.url));
if(existsSync(webRoot)) {
  app.use(express.static(webRoot));
  app.get('*',(_req,res)=>res.sendFile('index.html',{root:webRoot}));
}
const server=app.listen(port,'0.0.0.0',()=>console.log(`App listening on port ${port}`));
for(const signal of ['SIGINT','SIGTERM'] as const) {
  process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
}
