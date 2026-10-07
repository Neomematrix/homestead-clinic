import {db} from "@/lib/clinic-db";
import {contactSchema,patientSchema} from "@/lib/clinic";
import {listPatients,resolvePatient,patientStatements,samePatientIdentity} from "@/lib/patient-db";
import {workspace} from "@/app/api/records/route";
const duplicate=()=>Response.json({error:"Duplicate patient record already exists.",code:"DUPLICATE_PATIENT"},{status:409});
export async function POST(req:Request){
 try {
  const payload:any=await req.json(),w=await workspace();
  let parsed;
  if(payload.firstName===undefined){
   const contact=contactSchema.parse(payload);
   const existing=(await listPatients(w)).find(r=>r.patientId===payload.patientId);
   if(!existing)return Response.json({error:"Choose an existing demo patient."},{status:404});
   if(contact.dob!==existing.dob)return Response.json({error:"Birthdate must match the selected patient."},{status:400});
   parsed=patientSchema.safeParse({...existing,firstName:existing.firstName||existing.name.split(" ")[0],lastName:existing.lastName||existing.name.split(" ").slice(1).join(" "),...contact});
  }else parsed=patientSchema.safeParse(payload);
  if(!parsed.success)return Response.json({error:parsed.error.issues.map(issue=>`${issue.path.join(" ")}: ${issue.message}`).join("; ")},{status:400});
  const data=parsed.data,name=data.firstName+" "+data.lastName;
  const creating=payload.firstName!==undefined;
  if(creating&&(await listPatients(w)).some(existing=>samePatientIdentity(existing,data)))return duplicate();
  const patientId=await resolvePatient(w,name,data.dob,payload.patientId);
  const patient={...data,name,patientId};
  await db().batch(patientStatements(w,patient,creating));
  return Response.json({ok:true,patientId,patient},{status:201});
 }catch(e){if(String(e).includes("UNIQUE constraint failed: patients."))return duplicate();console.error(e);return Response.json({error:String(e).includes("PATIENT_MISMATCH")?"The name and birthdate must match the selected patient.":"Patient could not be saved. Your form is still available; please retry."},{status:String(e).includes("PATIENT_MISMATCH")?400:503});}
}
