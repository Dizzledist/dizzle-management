import {sync} from '@/lib/sync';
import {db,init} from '@/lib/db';
import {dailySyncWindow} from '@/lib/sync-policy';
import {syncSamples} from '@/lib/samples';
export const maxDuration=300;
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return new Response('Unauthorized',{status:401});
 const window=dailySyncWindow();if(!window.due)return Response.json({skipped:true,reason:'Outside the 6 PM PST window.'});
 try{await init();const sql=db();await sql`ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_daily_sync TEXT`;const [state]=await sql`SELECT last_daily_sync FROM sync_state WHERE id=1`;
 if(state.last_daily_sync===window.day)return Response.json({skipped:true,reason:'Daily sync already completed.'});
 const started=Date.now();const result=await sync();const samples=await syncSamples(undefined,Math.max(1000,270000-(Date.now()-started)));if(!result.more&&!samples.more)await sql`UPDATE sync_state SET last_daily_sync=${window.day} WHERE id=1`;return Response.json({...result,samples});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Sync failed'},{status:500});}
}
