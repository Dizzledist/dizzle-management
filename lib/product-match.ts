export function productMatchKey(name:string,description='',unit=''){
 const clean=(v:string)=>v.trim().toLowerCase().replace(/\s+/g,' ');
 return JSON.stringify([clean(name),clean(description),clean(unit)]);
}
