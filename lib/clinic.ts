import { z } from "zod";
const str=z.string().trim().min(1).max(300);
const date=str.refine(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v,"Use a valid date");
export const contactSchema=z.object({
 gender:z.string().trim().max(100).default(""),
 dob:date.refine(v=>v<=new Date().toISOString().slice(0,10),"Birthdate cannot be in the future"),
 homeAddress:str,
 phone:z.string().trim().max(40).refine(v=>/^[+\d\s().-]+$/.test(v)&&v.replace(/\D/g,"").length>=10&&v.replace(/\D/g,"").length<=15,"Enter a valid phone number"),
 email:z.string().trim().email("Enter a valid email address").max(254)
});
export const recordSchema=z.object({patientId:str,name:str,firstName:str,lastName:str,...contactSchema.shape,needs:z.string().max(1000),vaccine:str,date,dose:str,provider:str,description:str,lotNumber:str,manufacturer:str,location:str,city:str,state:z.enum(["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"]),cost:z.number().int().min(0).max(10000000),insurance:str});
export const fields=Object.keys(recordSchema.shape);
export function fixtures(prefix:string){return [0,1,2].map(i=>({patientId:prefix+"-"+(i+1),gender:"",name:["Alex Rivera","Morgan Lee","Sam Taylor"][i],firstName:["Alex","Morgan","Sam"][i],lastName:["Rivera","Lee","Taylor"][i],dob:["1994-04-12","1988-09-23","2001-01-15"][i],homeAddress:"123 Demo Lane, Homestead, FL 33030",phone:"305-555-010"+i,email:["alex","morgan","sam"][i]+"@example.com",needs:"Fictional routine clinic visit",vaccine:["Example Vaccine A","Example Vaccine B","Example Vaccine A"][i],date:"2026-10-05",dose:i===2?"2":"1",provider:"Nurse Jordan (fictional)",description:"Fictional vaccine for record-entry testing only.",lotNumber:["DEMO-LOT-A","DEMO-LOT-B","DEMO-LOT-C"][i],manufacturer:"Fictional Manufacturer",location:"Homestead, FL",city:"Homestead",state:"FL",cost:[2500,4000,2500][i],insurance:i===1?"None":"Demo Insurance"}));}

export const patientSchema=z.object({firstName:str,lastName:str,...contactSchema.shape,needs:z.string().max(1000),insurance:str});
