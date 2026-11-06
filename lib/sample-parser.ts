export type SampleEntry={name:string;quantity:number|null;key:string;source:string};
export function sampleKey(name:string){return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function isSampleName(name:string){return /\bsamples?\b/i.test(name);}
export function parseSampleDescription(description:string,parentQuantity=1):SampleEntry[]{
 const parts=description.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!parts.length)return [{name:'Unspecified samples',quantity:null,key:sampleKey('Unspecified samples'),source:description}];
 return parts.map(source=>{const prefix=source.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(.+)$/i);const suffix=source.match(/^(.+?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)$/i);const match=prefix|| (suffix?[suffix[0],suffix[2],suffix[1]]:null);
  // No quantity is assumed for free-form lines: they remain explicitly unresolved.
  const name=match?match[2].trim():source;const quantity=match&&Number.isFinite(parentQuantity)&&parentQuantity>0?Number(match[1])*parentQuantity:null;
  return {name,quantity,key:sampleKey(name),source};});
}
export function sampleEntriesFromLine(line:{name?:string;description?:string;quantity:unknown}):SampleEntry[]{
 const name=(line.name||'').trim();if(!isSampleName(name))return [];
 const quantity=Number(line.quantity);
 if(/^samples?$/i.test(name))return parseSampleDescription(line.description||'',quantity);
 return [{name,quantity:Number.isFinite(quantity)&&quantity>0?quantity:null,key:sampleKey(name),source:line.description||name}];
}
export function currentSampleMonth(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(now).slice(0,7);}
export function sampleMonthBounds(month:string){if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a valid month.');const [year,m]=month.split('-').map(Number);return {start:`${month}-01`,end:`${month}-${new Date(Date.UTC(year,m,0)).getUTCDate()}`};}
