import {redirect} from 'next/navigation';

export default async function LegacySamplesPage({searchParams}:{searchParams:Promise<{month?:string}>}){
 const {month}=await searchParams;
 redirect(typeof month==='string'&&month?`/samples?month=${encodeURIComponent(month)}`:'/samples');
}
