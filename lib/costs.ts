import {db} from './db';
import {productMatchKey} from './product-match';
export type Line={sku:string;quantity:number;itemId?:string;name?:string;description?:string;unit?:string;reference?:string};
export function decodeLines(input:unknown):Line[]{let value=input;for(let i=0;i<2&&typeof value==='string';i++)value=JSON.parse(value);if(!Array.isArray(value))throw new Error('Invalid stored invoice lines.');return value as Line[];}
export async function costTables(){const sql=db();await sql`CREATE TABLE IF NOT EXISTS products(sku TEXT PRIMARY KEY,title TEXT NOT NULL,cost NUMERIC NOT NULL)`;await sql`CREATE TABLE IF NOT EXISTS item_costs(item_id TEXT PRIMARY KEY,sku TEXT NOT NULL,title TEXT NOT NULL,cost NUMERIC NOT NULL)`;await sql`CREATE TABLE IF NOT EXISTS named_costs(match_key TEXT PRIMARY KEY,title TEXT NOT NULL,cost NUMERIC NOT NULL)`;await sql`CREATE TABLE IF NOT EXISTS invoice_line_costs(reference TEXT PRIMARY KEY,cost NUMERIC NOT NULL)`;await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lines JSONB NOT NULL DEFAULT '[]'`;}
export async function calculateCost(input:unknown){const lines=decodeLines(input);if(!lines.length)return null;const sql=db();
 const rows=await sql`SELECT sku,cost FROM products WHERE sku IN ${sql(lines.map(l=>l.sku))}`;const costs=new Map(rows.map(r=>[r.sku,Number(r.cost)]));
 const ids=lines.flatMap(l=>l.itemId?[l.itemId]:[]);const items=ids.length?await sql`SELECT item_id,cost FROM item_costs WHERE item_id IN ${sql(ids)}`:[];const itemCosts=new Map(items.map(r=>[r.item_id,Number(r.cost)]));
 const keys=lines.filter(l=>l.name&&!l.itemId&&!l.sku).map(l=>productMatchKey(l.name!,l.description,l.unit));
 const names=keys.length?await sql`SELECT match_key,cost FROM named_costs WHERE match_key IN ${sql(keys)}`:[];const nameCosts=new Map(names.map(r=>[r.match_key,Number(r.cost)]));
 const refs=lines.flatMap(l=>l.reference?[l.reference]:[]);const exact=refs.length?await sql`SELECT reference,cost FROM invoice_line_costs WHERE reference IN ${sql(refs)}`:[];const exactCosts=new Map(exact.map(r=>[r.reference,Number(r.cost)]));
 let total=0;for(const line of lines){const cost=(line.reference?exactCosts.get(line.reference):undefined)??(line.itemId?itemCosts.get(line.itemId):undefined)??costs.get(line.sku)??(!line.itemId&&!line.sku&&line.name?nameCosts.get(productMatchKey(line.name,line.description,line.unit)):undefined);if(cost===undefined||!Number.isFinite(line.quantity)||line.quantity<0)return null;total+=cost*line.quantity;}return Math.round(total*100)/100;
}
