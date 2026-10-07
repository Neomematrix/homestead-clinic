import * as records from "@/app/api/records/route";
import * as accuracy from "@/app/api/accuracy-records/route";
import * as measurement from "@/app/api/measure/route";
import * as intake from "@/app/api/patient-intake/route";
import * as backup from "@/app/api/records/export/route";
import {withGithubWorkspace} from "@/lib/github-context";
const origin="https://neomematrix.github.io";
function cors(response:Response){const headers=new Headers(response.headers);headers.set("Access-Control-Allow-Origin",origin);headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");headers.set("Access-Control-Allow-Headers","Content-Type, X-Clinic-Demo-Key");headers.set("Access-Control-Expose-Headers","Content-Disposition");headers.set("Vary","Origin");headers.set("Cache-Control","no-store");return new Response(response.body,{status:response.status,headers});}
export function OPTIONS(req:Request){return req.headers.get("Origin")===origin?cors(new Response(null,{status:204})):new Response(null,{status:403});}
async function dispatch(req:Request){
 if(req.headers.get("Origin")!==origin)return new Response("Origin not allowed",{status:403});
 const key=req.headers.get("X-Clinic-Demo-Key")||"";
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))return cors(Response.json({error:"Your demo workspace could not be opened. Reload the page."},{status:400}));
 const path=new URL(req.url).pathname.replace(/^\/api\/github\//,"");
 const response=await withGithubWorkspace(key,async()=>{
  if(req.method==="GET"){
   if(path==="records")return records.GET();
   if(path==="accuracy-records")return accuracy.GET();
   if(path==="records/export")return backup.GET(req);
  }else if(req.method==="POST"){
   if(path==="records")return records.POST(req);
   if(path==="accuracy-records")return accuracy.POST(req);
   if(path==="measure")return measurement.POST();
   if(path==="patient-intake")return intake.POST(req);
  }
  return Response.json({error:"Unknown clinic request"},{status:404});
 });
 return cors(response);
}
export const GET=dispatch;
export const POST=dispatch;
