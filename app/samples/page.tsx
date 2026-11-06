import type {Metadata} from 'next';
import {sampleDashboard} from '@/lib/samples';
import {currentSampleMonth} from '@/lib/sample-parser';
import SampleCost from './ui';
export const metadata:Metadata={title:'Samples · Dizzle Management'};
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{month?:string}>}){const params=await searchParams;const month=params.month||currentSampleMonth();try{return <SampleCost {...await sampleDashboard(month)}/>;}catch(e){return <SampleCost orders={[]} month={currentSampleMonth()} lastSync={null} error={e instanceof Error?e.message:'Unable to load sample costs.'}/>;}}
