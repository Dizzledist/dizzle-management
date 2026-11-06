import {z} from 'zod';
import {zoho} from './zoho';
import {db} from './db';

const text={type:'string'} as const;
const tool=(name:string,description:string,properties:Record<string,typeof text>)=>({type:'function',name,description,strict:true,parameters:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}});
export const assistantTools=[
 tool('search_invoices','Search live emailed, non-void Zoho invoices. Totals and customer averages use the full scanned set, even when the visible rows are limited. Dates are inclusive YYYY-MM-DD, use empty string for any optional filter.',{start:text,end:text,customer:text,rep:text,state:text,status:text}),
 tool('invoice_details','Look up a Zoho invoice number, its line items, contact and shipping information, actual applied payments, and saved Dizzle invoice cost if available.',{number:text}),
 tool('customers_by_product','Find customers who purchased a product by scanning actual invoice line items. Use product="flower" for 1g, 8g, 16g flower or pre-rolls. Dates required (YYYY-MM-DD); rep and shipping state can be blank.',{start:text,end:text,rep:text,state:text,product:text}),
];
type Row=Record<string,any>;
const clean=(v:unknown)=>String(v??'').trim();
const norm=(v:unknown)=>clean(v).toLowerCase();
const matches=(v:unknown,q:string)=>!q||norm(v).includes(norm(q));
const cents=(v:unknown)=>Math.round(Number(v||0)*100);
const summary=(i:Row)=>({number:i.invoice_number,date:i.date,customer:i.customer_name,rep:i.salesperson_name,currency:i.currency_code,total:i.total,balance:i.balance,status:i.status,city:i.shipping_address?.city,state:i.shipping_address?.state});
const filter=z.string().trim().max(120);
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v));
const stateKey=(v:unknown)=>['nv','nevada'].includes(norm(v))?'nv':norm(v);
function productMatches(line:Row,product:string){
 const name=clean(line.name), description=clean(line.description);
 if(!/\bflower\b/i.test(product))return [name,description,clean(line.sku)].some(v=>matches(v,product));
 if(/\bsamples?\b/i.test(name))return false;
 const text=name+' '+description;
 return /\bpre[\s-]?rolls?\b/i.test(text)||(/\b(?:flower|cheddr)\b/i.test(text)&&/(?<![\d.])(?:1|8|16)\s*(?:g|grams?)\b/i.test(text));
}

async function customersByProduct(args:unknown){
 const p=z.object({start:date,end:date,rep:filter,state:filter,product:filter.min(1)}).parse(args);
 if(!p.start||!p.end||p.start>p.end)throw Error('Invalid date range');
 const started=Date.now();
 const candidates=new Map<string,Row>();
 let complete=false;
 for(let page=1;page<=20&&Date.now()-started<25000;page++){
  const data=await zoho(`invoices?page=${page}&per_page=200&sort_column=date&sort_order=D`);
  for(const i of data.invoices as Row[]){
   if(i.date<p.start){complete=true;break;}
   if(i.date<=p.end&&i.is_emailed&&!['void','draft'].includes(i.status)&&matches(i.salesperson_name,p.rep)&&(!p.state||stateKey(i.shipping_address?.state)===stateKey(p.state))&&/^\d+$/.test(String(i.invoice_id)))candidates.set(i.invoice_id,i);
  }
  if(complete||!data.page_context?.has_more_page){complete=true;break;}
 }
 const matchesByCustomer=new Map<string,{customer:string;city:string;invoices:{number:string;date:string;products:string[]}[]}>();
 const invoices=[...candidates.values()];
 let checked=0,failed=0;
 for(let n=0;n<Math.min(invoices.length,90)&&Date.now()-started<28000;n+=4){
  await Promise.all(invoices.slice(n,Math.min(n+4,90)).map(async row=>{
   try{
    const {invoice:i}=await zoho('invoices/'+row.invoice_id);
    const products=[...new Set<string>((i.line_items as Row[]).filter(l=>Number(l.quantity)>0&&Number(l.item_total??(Number(l.rate)*Number(l.quantity)))>0&&productMatches(l,p.product)).map(l=>clean(l.name)))];
    checked++;
    if(!products.length)return;
    const group=matchesByCustomer.get(row.customer_id)||{customer:String(row.customer_name),city:clean(row.shipping_address?.city),invoices:[] as {number:string;date:string;products:string[]}[]};
    group.invoices.push({number:row.invoice_number,date:row.date,products});matchesByCustomer.set(row.customer_id,group);
   }catch{failed++;}
  }));
 }
 return {filters:p,complete:complete&&checked===invoices.length,checked,failed,candidates:invoices.length,customerCount:matchesByCustomer.size,customers:[...matchesByCustomer.values()].sort((a,b)=>a.customer.localeCompare(b.customer))};
}

export async function runAssistantTool(name:string,args:unknown){
 if(name==='customers_by_product')return customersByProduct(args);
 if(name==='invoice_details'){
  const {number}=z.object({number:z.string().trim().regex(/^[A-Za-z0-9-]{1,40}$/)}).parse(args);
  const d=await zoho('invoices?invoice_number='+encodeURIComponent(number));
  const match=(d.invoices as Row[]).find(i=>norm(i.invoice_number)===norm(number));
  if(!match)return {found:false};
  const id=String(match.invoice_id);
  if(!/^\d+$/.test(id))throw new Error('Invalid invoice ID');
  const {invoice:i}=await zoho('invoices/'+id);
  const [payments,stored]=await Promise.all([
   zoho('invoices/'+id+'/payments').then(d=>(d.payments||[]).map((p:Row)=>({number:p.payment_number,date:p.date,amount:p.amount,mode:p.payment_mode}))).catch(()=>null),
   process.env.DATABASE_URL?db()`SELECT cost,modified FROM invoices WHERE id=${id}`.catch(()=>[]):[],
  ]);
  const saved=stored[0];
  return {...summary(i),email:i.email,phone:i.shipping_address?.phone||i.phone,shipping:i.shipping_address?{city:i.shipping_address.city,state:i.shipping_address.state,zip:i.shipping_address.zipcode}:null,
   lines:(i.line_items||[]).map((l:Row)=>({name:l.name,sku:l.sku,quantity:l.quantity,amount:l.item_total})),payments,paymentNote:payments===null?'Payment details unavailable':undefined,
   savedCost:saved?.cost!=null&&saved.modified===i.last_modified_time?Number(saved.cost):null};
 }
 if(name!=='search_invoices')throw new Error('Unknown tool');
 const p=z.object({start:date,end:date,customer:filter,rep:filter,state:filter,status:z.enum(['','open','paid'])}).parse(args);
 if(p.start&&p.end&&p.start>p.end)throw new Error('Start must precede end');
 const groups=new Map<string,{customer:string;currency:string;count:number;salesCents:number;balanceCents:number}>();
 const totals=new Map<string,{currency:string;count:number;salesCents:number;balanceCents:number}>();
 const rows=[];const seen=new Set();let complete=false;
 for(let page=1;page<=20;page++){
  const data=await zoho(`invoices?page=${page}&per_page=200&sort_column=date&sort_order=D`);
  for(const i of data.invoices as Row[]){
   if(p.start&&i.date<p.start){complete=true;break;}
   if((p.end&&i.date>p.end)||seen.has(i.invoice_id)||!i.is_emailed||['void','draft'].includes(i.status))continue;
   seen.add(i.invoice_id);
   if(!matches(i.customer_name,p.customer)||!matches(i.salesperson_name,p.rep))continue;
   const state=(v:unknown)=>['nv','nevada'].includes(norm(v))?'nv':norm(v);
   if(p.state&&state(i.shipping_address?.state)!==state(p.state))continue;
   if((p.status==='open'&&Number(i.balance)<=0)||(p.status==='paid'&&i.status!=='paid'))continue;
   const currency=i.currency_code;
   const key=currency+':'+i.customer_id;
   const g=groups.get(key)||{customer:i.customer_name,currency,count:0,salesCents:0,balanceCents:0};
   const t=totals.get(currency)||{currency,count:0,salesCents:0,balanceCents:0};
   for(const x of [g,t]){x.count++;x.salesCents+=cents(i.total);x.balanceCents+=cents(i.balance);}
   groups.set(key,g);totals.set(currency,t);
   if(rows.length<35)rows.push(summary(i));
  }
  if(complete||!data.page_context?.has_more_page){complete=true;break;}
 }
 const customers=[...groups.values()].sort((a,b)=>b.salesCents-a.salesCents);
 const result=<T extends {count:number;salesCents:number;balanceCents:number}>(x:T)=>{const {salesCents,balanceCents,...rest}=x;return {...rest,sales:salesCents/100,outstanding:balanceCents/100,aov:Math.round(salesCents/x.count)/100};};
 return {complete,filters:p,totals:[...totals.values()].map(result),customerCount:customers.length,customers:customers.slice(0,50).map(result),invoices:rows,limits:'At most 50 customers and 35 invoices displayed. If complete is false, all totals are partial; narrow the date range.'};
}
