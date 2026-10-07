export const repeatMessage="Cannot administer vaccine again. Must wait 30 days after the initial vaccine.";
export function normalizeVaccine(name:string){return name.trim().toLowerCase();}
export function findRecentVaccination(records:any[],patientId:string,vaccine:string,date:string){
if(!patientId||!vaccine.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
const candidate=Date.parse(date+"T00:00:00Z");if(!Number.isFinite(candidate))return null;
const matches=records.filter(r=>r.patientId===patientId&&normalizeVaccine(r.vaccine)===normalizeVaccine(vaccine)&&Math.abs(candidate-Date.parse(r.date+"T00:00:00Z"))<30*86400000).sort((a,b)=>b.date.localeCompare(a.date));
if(!matches.length)return null;const previous=matches[0];return {previousDate:previous.date,nextDate:new Date(Date.parse(previous.date+"T00:00:00Z")+30*86400000).toISOString().slice(0,10)};
}
