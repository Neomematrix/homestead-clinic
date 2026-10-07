import { env } from "cloudflare:workers";
import { accuracyStatement } from "./accuracy-data";
export function db():D1Database {const d=(env as unknown as {DB?:D1Database}).DB;if(!d)throw new Error("Database unavailable");return d;}
export async function insertRecord(workspace:string,r:any,enforceSpacing=false,trackAccuracy=true){const id=crypto.randomUUID();const values=[id,workspace,r.patientId,r.name,r.dob,r.needs,r.vaccine,r.date,r.dose,r.provider,r.description,"",r.location,r.cost,r.insurance,r.firstName,r.lastName,r.lotNumber,r.manufacturer,r.city,r.state,r.homeAddress,r.phone,r.email,r.gender||""];
const guard=enforceSpacing?" WHERE NOT EXISTS (SELECT 1 FROM records WHERE workspace=? AND (patient_id=? OR (lower(trim(name))=lower(trim(?)) AND dob=? AND patient_id NOT LIKE 'TEST-%')) AND lower(trim(vaccine))=lower(trim(?)) AND abs(julianday(date)-julianday(?))<30)":"";
const sql="INSERT INTO records (id,workspace,patient_id,name,dob,needs,vaccine,date,dose,provider,description,sku,location,cost,insurance,first_name,last_name,lot_number,manufacturer,city,state,home_address,phone,email,gender) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?"+guard;
if(enforceSpacing)values.push(workspace,r.patientId,r.name,r.dob,r.vaccine,r.date);const statement=db().prepare(sql).bind(...values);
if(!trackAccuracy)return statement.run();
const results=await db().batch([statement,accuracyStatement(workspace,id,r)]);return results[0];}
export function normalize(r:any){const {patient_id,first_name,last_name,lot_number,manufacturer,home_address,sku,...rest}=r;return {...rest,patientId:patient_id,firstName:first_name,lastName:last_name,lotNumber:lot_number,manufacturer,homeAddress:home_address};}
