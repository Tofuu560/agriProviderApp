import { connect } from './core.js';
import { dispatch } from './jobs.js';
await connect();await dispatch();setInterval(()=>dispatch().catch(()=>console.error('Outbox cycle failed')),10000);
