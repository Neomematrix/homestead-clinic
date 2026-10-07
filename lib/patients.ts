export function patientKey(r:{name:string;dob:string}){return r.name.trim().toLowerCase()+"|"+r.dob;}
export function patientDirectory(rows:any[]){
  const patients=new Map<string,any>();
  for(const r of rows){if(r.patientId.startsWith("TEST-"))continue;const key=patientKey(r);if(!patients.has(key)||r.patientId<patients.get(key).patientId)patients.set(key,r);}
  return Array.from(patients.values());
}
export function patientHistory(rows:any[],id:string){
  const patient=rows.find(r=>r.patientId===id);
  return patient?rows.filter(r=>!r.patientId.startsWith("TEST-")&&patientKey(r)===patientKey(patient)):[];
}
