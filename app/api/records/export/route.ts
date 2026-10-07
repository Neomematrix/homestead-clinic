import {listPatients} from "@/lib/patient-db";
import {db,normalize} from "@/lib/clinic-db";
import {workspace} from "@/app/api/records/route";

function csvCell(value:unknown){
  let text=String(value??"");
  // Keep spreadsheet applications from interpreting patient-entered text as formulas.
  if(/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export async function GET(req:Request){
  const format=new URL(req.url).searchParams.get("format")||"json";
  if(format!=="json"&&format!=="csv")return Response.json({error:"Choose CSV or JSON."},{status:400});
  try{
    const w=await workspace();
    const result=await db().prepare("SELECT * FROM records WHERE workspace=? AND patient_id NOT LIKE 'TEST-%' ORDER BY date DESC,name,id").bind(w).all();
    const records=result.results.map((row:any)=>{
      const {workspace:internalWorkspace,...record}=normalize(row);
      return {...record,legacySku:row.sku||""};
    });
    const patients=await listPatients(w);
    const exportedAt=new Date().toISOString();
    const columns=["id","patientId","name","firstName","lastName","gender","dob","homeAddress","phone","email","needs","vaccine","date","dose","provider","description","lotNumber","manufacturer","location","city","state","cost","insurance","legacySku"];
    const body=format==="json"?JSON.stringify({schemaVersion:3,patients,exportedAt,recordCount:records.length,costUnit:"cents",records},null,2):"\uFEFF"+[columns.map(key=>csvCell(key==="cost"?"costCents":key)).join(","),...[...records,...patients.filter(p=>!records.some(r=>r.patientId===p.patientId))].map((r:any)=>columns.map(key=>csvCell(r[key])).join(","))].join("\r\n");
    return new Response(body,{headers:{"Content-Type":format==="json"?"application/json; charset=utf-8":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="clinic-records-backup-${exportedAt.slice(0,10)}.${format}"`,"Cache-Control":"no-store"}});
  }catch(e){console.error(e);return Response.json({error:"Backup could not be downloaded. Please try again."},{status:503});}
}
