import {listPatients,resolvePatient,patientStatements,samePatientIdentity} from "@/lib/patient-db";
import {db,recordStatement,normalize} from "@/lib/clinic-db";
import {accuracyStatement} from "@/lib/accuracy-data";
import {recordSchema} from "@/lib/clinic";
import {repeatMessage} from "@/lib/vaccine-spacing";
import {headers} from "next/headers";
import {githubWorkspace} from "@/lib/github-context";
export async function workspace(){return githubWorkspace()||(await headers()).get("oai-authenticated-user-id")||"local-demo";}
export async function GET(){try{const w=await workspace();const rows=await db().prepare("SELECT * FROM records WHERE workspace=? AND patient_id NOT LIKE 'TEST-%' ORDER BY date DESC,name").bind(w).all();const run=await db().prepare("SELECT report FROM runs WHERE workspace=? ORDER BY created DESC LIMIT 1").bind(w).first<{report:string}>();return Response.json({records:rows.results.map(normalize),patients:await listPatients(w),report:run?JSON.parse(run.report):null},{headers:{"Cache-Control":"no-store"}});}catch(e){console.error(e);return Response.json({error:"Records could not be loaded. Please try again."},{status:503});}}
const duplicatePatient=()=>Response.json({error:"Duplicate patient record already exists. Select the existing patient to add a vaccination.",code:"DUPLICATE_PATIENT"},{status:409});
export async function POST(req:Request){try{
 const payload:Record<string,unknown>=await req.json(),w=await workspace();
 const firstName=typeof payload.firstName==="string"?payload.firstName.trim():"",lastName=typeof payload.lastName==="string"?payload.lastName.trim():"";
 // Validate before resolving identity or issuing any writes.
 const parsed=recordSchema.safeParse({...payload,patientId:"pending",firstName,lastName,name:firstName+" "+lastName,location:typeof payload.city==="string"&&typeof payload.state==="string"?payload.city.trim()+", "+payload.state:""});
 if(!parsed.success)return Response.json({error:"Complete all required fields, including birthdate, home address, a valid phone number and email. Birthdate cannot be in the future."},{status:400});
 const patients=await listPatients(w),creating=!payload.patientId;
 const existing=creating?undefined:patients.find(p=>p.patientId===payload.patientId);
 if(!creating&&(!existing||!samePatientIdentity(existing,parsed.data)))return Response.json({error:"The name and date of birth must match the selected patient."},{status:400});
 if(creating&&patients.some(p=>samePatientIdentity(p,parsed.data)))return duplicatePatient();
 // Vaccination entry is not a patient-edit operation. Reject stale/changed
 // details rather than silently discarding edits or overwriting the profile.
 const details=["gender","homeAddress","phone","email","needs","insurance"] as const;
 if(existing&&details.some(key=>(existing[key]||"")!==parsed.data[key]))return Response.json({error:"Patient information differs from the saved profile. Use Edit patient to make changes, then select the patient again.",code:"PATIENT_DETAILS_CHANGED"},{status:409});
 const patientId=existing?.patientId||await resolvePatient(w,parsed.data.name,parsed.data.dob);
 const r={...parsed.data,patientId};
 const id=crypto.randomUUID();
 // D1 batch is transactional. A competing new-patient insert must roll back
 // the vaccination and accuracy snapshot too. Existing profiles are untouched.
 const statements=creating?[patientStatements(w,r,true)[0]]:[];
 const recordIndex=statements.length;
 statements.push(recordStatement(w,r,id,true),accuracyStatement(w,id,r));
 const results=await db().batch(statements);
 if(results[recordIndex].meta.changes===0)return Response.json({error:repeatMessage,code:"VACCINE_TOO_SOON"},{status:409});
 return Response.json({ok:true,patientId},{status:201});
 }catch(e){
 if(String(e).includes("UNIQUE constraint failed: patients."))return duplicatePatient();
 if(String(e).includes("PATIENT_MISMATCH"))return Response.json({error:"The name and date of birth must match the selected patient."},{status:400});
 if(String(e).includes("UNIQUE"))return Response.json({error:"Possible duplicate: this patient, vaccine, date and dose already exist. Review the existing record; nothing was removed."},{status:409});
 console.error(e);return Response.json({error:"Record could not be saved. Your form is still available; please retry."},{status:503});
 }
}
