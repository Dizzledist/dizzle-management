export const INVOICE_START_DATE='2026-10-01';
export function invoiceEndDate(now:Date=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return today;
}
export function isEligibleInvoiceDate(date:unknown):date is string {
 return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=INVOICE_START_DATE&&date<=invoiceEndDate();
}
export function dailySyncWindow(now:Date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Etc/GMT+8',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {due:part('hour')==='18',day:`${part('year')}-${part('month')}-${part('day')}`};
}
