import {dashboard} from '@/lib/db';
import Dashboard from './ui';
export const dynamic='force-dynamic';
export default async function Page(){try{return <Dashboard {...await dashboard()}/>;}catch{return <Dashboard invoices={[]} lastSync={null} configured={false} initialError="Unable to load the database. Check your connection settings."/>;}}
