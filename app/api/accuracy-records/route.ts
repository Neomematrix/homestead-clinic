import {insertRecord} from "@/lib/clinic-db";
import {recordSchema} from "@/lib/clinic";
import {loadAccuracy} from "@/lib/accuracy-data";
import {workspace} from "../records/route";
export async function GET(){try{return Response.json({records:await loadAccuracy(await workspace())},{headers:{"Cache-Control":"no-store"}});}catch(e){console.error(e);return Response.json({error:"The accuracy dataset could not be loaded. Please retry."},{status:503});}}
export async function POST(req:Request){try{
 const payload:any=await req.json(),w=await workspace();
 const firstName=typeof payload.firstName==="string"?payload.firstName.trim():"",lastName=typeof payload.lastName==="string"?payload.lastName.trim():"";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([w,(firstName+" "+lastName).toLowerCase(),payload.dob])));
 const patientId="TEST-"+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const parsed=recordSchema.safeParse({...payload,firstName,lastName,name:firstName+" "+lastName,patientId,location:typeof payload.city==="string"&&typeof payload.state==="string"?payload.city.trim()+", "+payload.state:""});
 if(!parsed.success)return Response.json({error:"Complete every required patient and vaccination field with fictional information."},{status:400});
 await insertRecord(w,parsed.data);
 return Response.json({ok:true,patientId:parsed.data.patientId},{status:201});
 }catch(e){if(String(e).includes("UNIQUE"))return Response.json({error:"Repeat submission blocked: this accuracy-test record is already saved."},{status:409});console.error(e);return Response.json({error:"Accuracy-test record could not be saved. Your form is retained; please retry."},{status:503});}}
