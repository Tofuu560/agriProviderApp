import { db,transaction,system,fail } from './core.js';
import { invite } from './admin.js';
const args=process.argv.slice(2),get=(key:string)=>args[args.indexOf(key)+1];
const email=get('--email'),fullName=get('--name');
if(!email||!fullName)throw new Error('Usage: pnpm --filter @agri/api bootstrap:admin --email EMAIL --name NAME');
await transaction(async tx=>{if(await tx.user.count({where:{role:'ADMIN'}})&&!(process.env.ALLOW_BOOTSTRAP==='true'&&args.includes('--force')))fail('ADMIN_EXISTS','An administrator already exists.',409);await invite(tx,system,{email:email.toLowerCase(),fullName,role:'ADMIN'});});
console.log('Bootstrap invitation queued. Run the outbox worker to deliver the one-time setup link.');await db.$disconnect();
