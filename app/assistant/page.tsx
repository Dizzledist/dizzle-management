import type {Metadata} from 'next';
import AssistantChat from './ui';

export const metadata:Metadata={title:'Zoho Assistant · Dizzle Management'};
export const dynamic='force-dynamic';
export default async function Page(){
 return <AssistantChat configured={Boolean(process.env.OPENAI_API_KEY)}/>;
}
