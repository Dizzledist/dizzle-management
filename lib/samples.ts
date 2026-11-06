import {db,init} from './db';
import {costTables} from './costs';
import {zoho} from './zoho';
import {currentSampleMonth,sampleEntriesFromLine,sampleKey,sampleMonthBounds,SampleEntry} from './sample-parser';
export type SampleRow=SampleEntry&{unitCost:number|null;cost:number|null;basis:string};
export type SampleOrder={id:string;number:string;date:string;customer:string;rep:string;currency:string;entries:SampleRow[]};
export async function sampleTables(){await init();await costTables();const sql=db();await sql`CREATE TABLE IF NOT EXISTS sample_orders(id TEXT PRIMARY KEY,number TEXT NOT NULL,date TEXT NOT NULL,customer TEXT NOT NULL,rep TEXT NOT NULL,currency TEXT NOT NULL,modified TEXT NOT NULL,entries JSONB NOT NULL)`;await sql`CREATE TABLE IF NOT EXISTS sample_unit_costs(match_key TEXT NOT NULL,currency TEXT NOT NULL,name TEXT NOT NULL,cost NUMERIC NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(match_key,currency))`;await sql`CREATE TABLE IF NOT EXISTS sample_sync(month TEXT PRIMARY KEY,last_sync TIMESTAMPTZ,locked_until TIMESTAMPTZ)`;}
function readEntries(value:unknown):SampleEntry[]{let data=value;for(let i=0;i<2&&typeof data==='string';i++)data=JSON.parse(data);return Array.isArray(data)?data:[];}
export async function sampleDashboard(month=currentSampleMonth()){
 sampleMonthBounds(month);if(!process.env.DATABASE_URL)return {orders:[] as SampleOrder[],lastSync:null,month};await sampleTables();const sql=db();const {start,end}=sampleMonthBounds(month);
 const [orders,rules,catalog,state]=await Promise.all([sql`SELECT * FROM sample_orders WHERE date>=${start} AND date<=${end} ORDER BY date DESC,number DESC`,sql`SELECT match_key,currency,cost FROM sample_unit_costs`,sql`SELECT title,cost FROM item_costs UNION ALL SELECT title,cost FROM named_costs`,sql`SELECT last_sync FROM sample_sync WHERE month=${month}`]);
 const saved=new Map(rules.map(r=>[`${r.currency}:${r.match_key}`,Number(r.cost)]));const candidates=new Map<string,Set<number>>();for(const p of catalog){const key=sampleKey(p.title);const set=candidates.get(key)||new Set<number>();set.add(Number(p.cost));candidates.set(key,set);}
 const rows:SampleOrder[]=orders.map(o=>({...o,entries:readEntries(o.entries).map(e=>{const exact=o.currency==='USD'?candidates.get(e.key):undefined;const savedKey=`${o.currency}:${e.key}`;const cost=saved.get(savedKey)??(exact?.size===1?[...exact][0]:undefined);return {...e,unitCost:cost??null,cost:cost===undefined||e.quantity===null?null:Math.round(cost*e.quantity*100)/100,basis:saved.has(savedKey)?'Saved sample cost':cost===undefined?'Needs sample cost':'Exact catalog name'};})})) as SampleOrder[];
 return {orders:rows.filter(o=>o.entries.length>0),lastSync:state[0]?.last_sync?new Date(state[0].last_sync).toISOString():null,month};
}
export async function syncSamples(month=currentSampleMonth(),budgetMs=210000){
 const {start,end}=sampleMonthBounds(month);if(month>currentSampleMonth())throw new Error('Future months cannot be synced.');await sampleTables();const sql=db();await sql`INSERT INTO sample_sync(month) VALUES(${month}) ON CONFLICT DO NOTHING`;const lease=await sql`UPDATE sample_sync SET locked_until=NOW()+INTERVAL '5 minutes' WHERE month=${month} AND (locked_until IS NULL OR locked_until<NOW()) RETURNING month`;if(!lease.length)throw new Error('Sample sync for this month is already running.');
 let scanned=0;let sampleOrders=0;const started=Date.now();
 try{const existing=await sql`SELECT id,modified,entries FROM sample_orders WHERE date>=${start} AND date<=${end}`;const byId=new Map(existing.map(o=>[o.id,o]));let more=true;let page=1;let reached=false;
  while(more){const data=await zoho(`invoices?page=${page}&per_page=200&sort_column=date&sort_order=D`);for(const summary of data.invoices){if(summary.date<start){reached=true;break;}if(summary.date>end)continue;if(Date.now()-started>budgetMs)return {scanned,sampleOrders,more:true};const id=String(summary.invoice_id);
   if(summary.status==='void'||!summary.is_emailed){await sql`DELETE FROM sample_orders WHERE id=${id}`;continue;}
   const stored=byId.get(id);if(stored&&stored.modified===summary.last_modified_time){if(readEntries(stored.entries).length)sampleOrders++;continue;}
   const {invoice:i}=await zoho(`invoices/${id}`);if(i.status==='void'||!i.is_emailed){await sql`DELETE FROM sample_orders WHERE id=${id}`;continue;}
   const entries:SampleEntry[]=i.line_items.flatMap(sampleEntriesFromLine);
   await sql`INSERT INTO sample_orders(id,number,date,customer,rep,currency,modified,entries) VALUES(${id},${i.invoice_number},${i.date},${i.customer_name},${(i.salesperson_name||'').trim()},${i.currency_code},${i.last_modified_time||summary.last_modified_time||''},${sql.json(entries)}) ON CONFLICT(id) DO UPDATE SET number=EXCLUDED.number,date=EXCLUDED.date,customer=EXCLUDED.customer,rep=EXCLUDED.rep,currency=EXCLUDED.currency,modified=EXCLUDED.modified,entries=EXCLUDED.entries`;scanned++;if(entries.length)sampleOrders++;await new Promise(r=>setTimeout(r,650));
  }more=!reached&&Boolean(data.page_context?.has_more_page);page++;}
  await sql`UPDATE sample_sync SET last_sync=NOW() WHERE month=${month}`;return {scanned,sampleOrders,more:false};
 }finally{await sql`UPDATE sample_sync SET locked_until=NULL WHERE month=${month}`;}
}
