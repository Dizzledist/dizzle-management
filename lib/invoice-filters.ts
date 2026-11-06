export type InvoiceStatusFilter='all'|'open'|'closed';
export function invoiceStatus(status?:string|null):'paid'|'open'|'unknown'{
 if(!status)return 'unknown';return status.toLowerCase()==='paid'?'paid':'open';
}
export function toggleInvoiceStatus(current:InvoiceStatusFilter,selected:'open'|'closed'):InvoiceStatusFilter{return current===selected?'all':selected;}
export type FilterableInvoice={date:string;sales_rep?:string|null;status?:string|null};
export function matchesInvoiceFilters(invoice:FilterableInvoice,start:string,end:string,rep:string,status:InvoiceStatusFilter='all'){
 const state=invoiceStatus(invoice.status);
 return (!start||invoice.date>=start)&&(!end||invoice.date<=end)&&(!rep||(rep==='__unassigned__'?!invoice.sales_rep:invoice.sales_rep===rep))&&(status==='all'||(status==='closed'?state==='paid':state==='open'));
}
