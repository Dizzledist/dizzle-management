import {db,init} from '@/lib/db';
import {costTables,calculateCost,Line} from '@/lib/costs';
import {parseCostCsv} from '@/lib/cost-csv';
import {productMatchKey} from '@/lib/product-match';
import {zoho} from '@/lib/zoho';
export const maxDuration=300;
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
 try{const products=parseCostCsv(await req.text());await init();await costTables();const sql=db();
 const referenced=products.filter(p=>p.lineReferences.length);const lineProducts=new Map(referenced.flatMap(p=>p.lineReferences.map(ref=>[ref,p] as const)));
 const enriched:{id:string;lines:Line[]}[]=[];
 if(referenced.length){
  const numbers=[...new Set([...lineProducts.keys()].map(ref=>ref.split(':')[0]))];
  const invoices=await sql`SELECT id,number FROM invoices WHERE number IN ${sql(numbers)}`;
  const verified=new Set<string>();
  for(const row of invoices){const {invoice}=await zoho(`invoices/${row.id}`);const lines:Line[]=invoice.line_items.map((item:Record<string,unknown>)=>({sku:String(item.sku||'').trim(),quantity:Number(item.quantity),itemId:item.item_id?String(item.item_id):undefined,name:String(item.name||item.description||'Unnamed invoice line').trim(),description:String(item.description||'').trim(),unit:String(item.unit||'').trim(),reference:`${invoice.invoice_number}:${item.line_item_id}`}));
   for(const line of lines){const p=lineProducts.get(line.reference!);if(!p)continue;if(productMatchKey(line.name!,line.description,line.unit)!==productMatchKey(p.title,p.description,p.unit))throw new Error(`Product details do not match invoice line ${line.reference}.`);verified.add(line.reference!);}
   enriched.push({id:row.id,lines});
  }
  if(verified.size!==lineProducts.size)throw new Error('Some invoice line references could not be verified. No costs were imported.');
 }
 await sql.begin(async tx=>{
  const named=products.filter(p=>!p.sku&&!p.itemId).map(p=>({match_key:productMatchKey(p.title,p.description,p.unit),title:p.title,cost:p.cost}));
  if(named.length)await tx`INSERT INTO named_costs ${tx(named,'match_key','title','cost')} ON CONFLICT(match_key) DO UPDATE SET title=EXCLUDED.title,cost=EXCLUDED.cost`;
  const exact=[...lineProducts].map(([reference,p])=>({reference,cost:p.cost}));
  if(exact.length)await tx`INSERT INTO invoice_line_costs ${tx(exact,'reference','cost')} ON CONFLICT(reference) DO UPDATE SET cost=EXCLUDED.cost`;
  for(const invoice of enriched)await tx`UPDATE invoices SET lines=${tx.json(invoice.lines)} WHERE id=${invoice.id}`;
  const identified=products.filter(p=>p.itemId).map(p=>({item_id:p.itemId!,sku:p.sku,title:p.title,cost:p.cost}));
  for(let i=0;i<identified.length;i+=500)await tx`INSERT INTO item_costs ${tx(identified.slice(i,i+500),'item_id','sku','title','cost')} ON CONFLICT(item_id) DO UPDATE SET sku=EXCLUDED.sku,title=EXCLUDED.title,cost=EXCLUDED.cost`;
  const skus=[...new Set(products.map(p=>p.sku).filter(Boolean))];
  const ambiguousRows=skus.length?await tx`SELECT sku FROM item_costs WHERE sku IN ${tx(skus)} GROUP BY sku HAVING COUNT(*)>1`:[];
  const ambiguous=new Set(ambiguousRows.map(r=>r.sku));
  if(ambiguous.size)await tx`DELETE FROM products WHERE sku IN ${tx([...ambiguous])}`;
  const unambiguous=products.filter(p=>p.sku&&!ambiguous.has(p.sku)).map(p=>({sku:p.sku,title:p.title,cost:p.cost}));
  for(let i=0;i<unambiguous.length;i+=500)await tx`INSERT INTO products ${tx(unambiguous.slice(i,i+500),'sku','title','cost')} ON CONFLICT(sku) DO UPDATE SET title=EXCLUDED.title,cost=EXCLUDED.cost`;
 });
 const invoices=await sql`SELECT id,lines FROM invoices`;for(const inv of invoices){const cost=await calculateCost(inv.lines as Line[]);await sql`UPDATE invoices SET cost=${cost} WHERE id=${inv.id}`;}
 return Response.json({imported:products.length});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
