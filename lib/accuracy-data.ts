import {db,normalize} from "./clinic-db";
import {fields} from "./clinic";
export function originalFields(r:any){return Object.fromEntries(fields.map(f=>[f,r[f]??""]));}
export function eventKey(r:any){return JSON.stringify([r.patientId,r.vaccine,r.date,r.dose]);}
export function accuracyStatement(w:string,id:string,r:any,source="Entered original"){
 return db().prepare("INSERT OR IGNORE INTO accuracy_expected (id,workspace,record_id,original,source) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM records WHERE id=? AND workspace=?)").bind(JSON.stringify([w,eventKey(r)]),w,id,JSON.stringify(originalFields(r)),source,id,w);
}
// Recover legacy originals once. Existing rows without retained inputs use a
// labelled baseline. This never creates fixture records on measurement.
export async function importAccuracy(w:string){
 if(await db().prepare("SELECT workspace FROM accuracy_imports WHERE workspace=?").bind(w).first())return;
 const [saved,runs]=await Promise.all([db().prepare("SELECT * FROM records WHERE workspace=?").bind(w).all(),db().prepare("SELECT report FROM runs WHERE workspace=? ORDER BY created").bind(w).all()]);
 const actual=saved.results.map(normalize), originals=new Map<string,any>();
 for(const row of runs.results)for(const check of JSON.parse(String(row.report)).checks||[]){
  const original=check.expected;if(!original)continue;
  const key=eventKey(original),record=actual.find(r=>eventKey(r)===key);
  if(!originals.has(key))originals.set(key,{original,id:record?.id||check.actual?.id||"legacy-missing:"+key,source:"Recovered original"});
 }
 for(const r of actual){const key=eventKey(r);if(!originals.has(key))originals.set(key,{original:r,id:r.id,source:"Existing saved baseline"});}
 const statements=[...originals.values()].map(({original,id,source})=>db().prepare("INSERT OR IGNORE INTO accuracy_expected (id,workspace,record_id,original,source) VALUES (?,?,?,?,?)").bind(JSON.stringify([w,eventKey(original)]),w,id,JSON.stringify(originalFields(original)),source));
 // Bounded, idempotent batches; mark completion only after all snapshots save.
 for(let i=0;i<statements.length;i+=50)await db().batch(statements.slice(i,i+50));
 await db().prepare("INSERT OR IGNORE INTO accuracy_imports (workspace) VALUES (?)").bind(w).run();
}
export async function loadAccuracy(w:string){
 await importAccuracy(w);
 const rows=await db().prepare("SELECT * FROM accuracy_expected WHERE workspace=? ORDER BY rowid").bind(w).all();
 return rows.results.map(r=>({id:String(r.id),recordId:String(r.record_id),source:String(r.source),original:JSON.parse(String(r.original))}));
}
export function compareAccuracy(expected:any[],actual:any[]){
 let missing=0,incorrect=0,duplicates=0,matched=0;
 const events=new Map<string,any[]>();
 for(const r of actual){const key=eventKey(r);events.set(key,[...(events.get(key)||[]),r]);}
 const checks=expected.map(snapshot=>{
  const original=snapshot.original,found=actual.find(r=>r.id===snapshot.recordId),copies=events.get(eventKey(original))||[];
  if(!found)missing++;
  const errors=found?fields.filter(f=>found[f]!==original[f]):[];incorrect+=errors.length;
  for(const copy of copies.filter(r=>r.id!==found?.id))incorrect+=fields.filter(f=>copy[f]!==original[f]).length;
  const extra=Math.max(0,copies.length-1);duplicates+=extra;
  const ok=!!found&&errors.length===0&&extra===0;if(ok)matched++;
  return {recordId:snapshot.recordId,patient:original.name,patientId:original.patientId,matched:ok,errors,expected:original,actual:found||null,source:snapshot.source};
 });
 return {expected:expected.length,saved:actual.length,matched,missing,incorrect,duplicates,checks};
}
