// Use the final amount shown on the Zoho invoice, after discounts and adjustments.
export function invoiceSales(invoice:{total:unknown}){
 const total=typeof invoice.total==='number'?invoice.total:typeof invoice.total==='string'&&invoice.total.trim()?Number(invoice.total):NaN;
 if(!Number.isFinite(total))throw new Error('Zoho invoice is missing a valid final total.');
 return total;
}
