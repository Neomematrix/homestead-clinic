import {db,normalize} from "./clinic-db";
import {patientDirectory,patientKey} from "./patients";
export async function listPatients(w:string){
 const [profiles,records]=await Promise.all([db().prepare("SELECT data FROM patients WHERE workspace=?").bind(w).all(),db().prepare("SELECT * FROM records WHERE workspace=? AND patient_id NOT LIKE 'TEST-%' ORDER BY date DESC").bind(w).all()]);
 const result=new Map(patientDirectory(records.results.map(normalize)).map(r=>[patientKey(r),r]));
 for(const row of profiles.results){const r=JSON.parse(String(row.data));result.set(patientKey(r),r);}
 return [...result.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export async function resolvePatient(w:string,name:string,dob:string,id?:string){
 const patients=await listPatients(w);
 const found=id?patients.find(r=>r.patientId===id):patients.find(r=>patientKey(r)===patientKey({name,dob}));
 if(id&&(!found||patientKey(found)!==patientKey({name,dob})))throw new Error("PATIENT_MISMATCH");
 if(found)return found.patientId;
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([w,name.trim().toLowerCase(),dob])));
 return "PAT-"+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export function patientStatements(w:string,r:any,createOnly=false){
 const data={patientId:r.patientId,name:r.name,firstName:r.firstName,lastName:r.lastName,gender:r.gender||"",dob:r.dob,homeAddress:r.homeAddress,phone:r.phone,email:r.email,needs:r.needs,insurance:r.insurance};
 return [db().prepare("INSERT INTO patients (patient_id,workspace,name,dob,data) VALUES (?,?,?,?,?)"+(createOnly?"":" ON CONFLICT(patient_id) DO UPDATE SET data=excluded.data")).bind(r.patientId,w,r.name.trim().toLowerCase(),r.dob,JSON.stringify(data)),db().prepare("UPDATE records SET first_name=?,last_name=?,gender=?,home_address=?,phone=?,email=? WHERE workspace=? AND lower(trim(name))=lower(trim(?)) AND dob=? AND patient_id NOT LIKE 'TEST-%'").bind(r.firstName,r.lastName,r.gender||"",r.homeAddress,r.phone,r.email,w,r.name,r.dob)];
}

// Compare the individual identity fields; legacy records may only have a name.
export function samePatientIdentity(existing:any,incoming:any){
 const clean=(value:string)=>value.trim().toLowerCase();
 const first=existing.firstName||existing.name.trim().split(/\s+/)[0];
 const last=existing.lastName||existing.name.trim().split(/\s+/).slice(1).join(" ");
 return clean(first)===clean(incoming.firstName)&&clean(last)===clean(incoming.lastName)&&clean(existing.dob)===clean(incoming.dob);
}
