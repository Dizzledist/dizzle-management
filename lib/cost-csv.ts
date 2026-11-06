import {parse} from 'csv-parse/sync';
import {productMatchKey} from './product-match';

export type ProductCost={sku:string;title:string;cost:number;itemId:string|null;description:string;unit:string;lineReferences:string[]};
export function parseCostCsv(body:string):ProductCost[]{
 if(Buffer.byteLength(body,'utf8')>2_000_000)throw new Error('CSV must be smaller than 2 MB.');
 const rows=parse(body,{bom:true,columns:(headers:string[])=>headers.map(h=>h.trim().toLowerCase()),skip_empty_lines:true,trim:true}) as Record<string,string>[];
 if(!rows.length)throw new Error('CSV is empty.');
 const products=rows.map((r,i)=>{
  const sku=(r.sku||r['sku number']||'').trim();
  const title=r.title||r['product title']||r['item name']||'';
  const raw=(r.cost??r['purchase price']??'').trim();
  const match=raw.match(/^(?:USD\s*|\$\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/);
  const cost=match?Number(match[1].replaceAll(',','')):NaN;
  const itemId=r['item id']||null;
  const description=r.description||'';const unit=r.unit||'';
  const lineReferences=(r['invoice line ids']||'').split(';').map(s=>s.trim()).filter(Boolean);
  if(!title||!Number.isFinite(cost)||cost<0||(!sku&&!itemId&&!lineReferences.length))throw new Error(`Row ${i+2}: item name/title, a valid non-negative USD cost, and SKU, Item ID, or invoice line references are required.`);
  if(lineReferences.some(ref=>!/^INV-[\w-]+:\d+$/.test(ref)))throw new Error(`Row ${i+2}: invalid invoice line reference.`);
  if(itemId&&!/^\d+$/.test(itemId))throw new Error(`Row ${i+2}: invalid Zoho Item ID.`);
  return {sku,title,cost,itemId,description,unit,lineReferences};
 });
 const identities=new Set<string>();
 for(const p of products){const identity=p.itemId?`id:${p.itemId}`:p.sku?`sku:${p.sku}`:`name:${productMatchKey(p.title,p.description,p.unit)}`;if(identities.has(identity))throw new Error(`Duplicate product identity: ${p.itemId||p.sku||p.title}.`);identities.add(identity);}
 const refs=new Set<string>();for(const p of products)for(const ref of p.lineReferences){if(refs.has(ref))throw new Error(`Duplicate invoice line reference: ${ref}`);refs.add(ref);}
 const groups=Map.groupBy(products.filter(p=>p.sku),p=>p.sku);
 for(const [sku,group] of groups)if(group.length>1&&group.some(p=>!p.itemId))throw new Error(`SKU ${sku} is duplicated. Unique Zoho Item IDs are required to distinguish these products.`);
 return products;
}
