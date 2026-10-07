import {db,insertRecord,normalize} from "@/lib/clinic-db";
import {fields} from "@/lib/clinic";
import {importAccuracy,compareAccuracy} from "@/lib/accuracy-data";
import {workspace} from "../records/route";
export async function POST(){try{
 const w=await workspace(),id=crypto.randomUUID(),start=performance.now();
 await importAccuracy(w);
 const [originals,read]=await db().batch([db().prepare("SELECT * FROM accuracy_expected WHERE workspace=? ORDER BY rowid").bind(w),db().prepare("SELECT * FROM records WHERE workspace=?").bind(w)]);
 const expected=originals.results.map((r:any)=>({recordId:r.record_id,source:r.source,original:JSON.parse(String(r.original))}));
 const actual=read.results.map(normalize),result=compareAccuracy(expected,actual);
 // Test exact repeat protection for every saved event without changing originals.
 let repeatAttempts=0,repeatBlocked=0;
 for(const r of actual){repeatAttempts++;try{await insertRecord(w,r,false,false);}catch(e){if(String(e).includes("UNIQUE"))repeatBlocked++;else throw e;}}
 if(repeatAttempts!==repeatBlocked)throw new Error("Repeat submission accepted; measurement aborted");
 const report={id,created:new Date().toISOString(),...result,repeatAttempts,repeatBlocked,duplicateBlocked:repeatAttempts>0&&repeatAttempts===repeatBlocked,elapsedMs:Math.round(performance.now()-start),conditions:`Compared all ${expected.length} saved accuracy-test originals against persistent records, ${fields.length} fields per record; ${repeatAttempts} exact repeat submissions attempted and ${repeatBlocked} blocked. New vaccination entries are included automatically.`,limits:"Fictional demonstration only. Existing records without a retained original use a labelled saved baseline, which cannot establish their accuracy before this update. Does not test real clinic workloads, security, outside registries, or clinical correctness."};
 await db().prepare("INSERT INTO runs (id,workspace,created,report) VALUES (?,?,?,?)").bind(id,w,report.created,JSON.stringify(report)).run();
 return Response.json({report},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error(e);return Response.json({error:"The measurement could not finish. The last completed result is retained; please retry."},{status:503});}}
