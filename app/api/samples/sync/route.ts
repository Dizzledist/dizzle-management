import {syncSamples} from '@/lib/samples';
export const maxDuration=300;
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});try{const body=await req.json();return Response.json(await syncSamples(body.month));}catch(e){return Response.json({error:e instanceof Error?e.message:'Sample sync failed.'},{status:400});}}
