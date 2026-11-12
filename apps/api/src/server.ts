import { createApp } from './app.js';
import { connect,db } from './core.js';
import { env } from './config.js';
import { dispatch,housekeeping } from './jobs.js';
const app=await createApp();
await app.listen({port:env.PORT,host:'0.0.0.0'});
await connect();await housekeeping();
if(env.INLINE_WORKER==='true'){await dispatch();const timer=setInterval(()=>dispatch().catch(()=>app.log.error('Outbox cycle failed')),10000);timer.unref();const cron=setInterval(()=>housekeeping().catch(()=>app.log.error('Housekeeping failed')),3600000);cron.unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();await db.$disconnect();process.exit(0);});
