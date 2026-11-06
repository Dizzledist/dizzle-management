import {sync} from '@/lib/sync';
export const maxDuration=300;
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});try{return Response.json(await sync());}catch(e){return Response.json({error:e instanceof Error?e.message:'Sync failed'},{status:500});}}
