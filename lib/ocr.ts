export async function extractInvoice(pdf:ArrayBuffer){
 const endpoint=process.env.AZURE_DOCUMENT_ENDPOINT;const key=process.env.AZURE_DOCUMENT_KEY;if(!endpoint||!key)return null;
 const response=await fetch(`${endpoint.replace(/\/$/,'')}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/pdf'},body:pdf});
 const operation=response.headers.get('operation-location');if(!response.ok||!operation)throw new Error('Invoice OCR could not start.');
 const operationUrl=new URL(operation);if(operationUrl.origin!==new URL(endpoint).origin)throw new Error('Invalid OCR response.');
 for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,1000));const result=await fetch(operation,{headers:{'Ocp-Apim-Subscription-Key':key},cache:'no-store'});if(!result.ok)throw new Error('Invoice OCR failed.');const data=await result.json();if(data.status==='succeeded')return data.analyzeResult;if(data.status==='failed')throw new Error('Invoice OCR failed.');}throw new Error('Invoice OCR timed out. Retry sync.');
}
