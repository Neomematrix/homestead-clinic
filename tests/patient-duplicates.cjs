// Integration checks against the real route handlers and SQL in an isolated database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=process.cwd(),dir=fs.mkdtempSync('/tmp/clinic-duplicate-test-');
let sqlite=new DatabaseSync(path.join(dir,'clinic.sqlite'));
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this},async all(){return {results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)||null},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)},results:[]}}}},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements){out.push(await s.all().then(r=>({...r,meta:{changes:sqlite.prepare('SELECT changes() AS n').get().n}})))}sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const cache=new Map();
function load(file){file=path.resolve(file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const req=id=>id==='cloudflare:workers'?{env:{DB}}:id==='next/headers'?{headers:async()=>new Headers()}:id.startsWith('@/')?load(path.join(root,id.slice(2))):id.startsWith('.')?load(path.resolve(path.dirname(file),id)):require(id);new Function('require','module','exports',js)(req,module,module.exports);return module.exports;}
const intake=load('app/api/patient-intake/route.ts'),records=load('app/api/records/route.ts'),accuracy=load('app/api/accuracy-records/route.ts'),measure=load('app/api/measure/route.ts');
const request=data=>new Request('http://test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 const original={firstName:'Fictional',lastName:'Duplicatecheck',dob:'1990-03-14',gender:'Nonbinary',homeAddress:'123 Fictional Lane, Miami, FL 33101',phone:'305-555-0199',email:'duplicatecheck@example.com',needs:'Fictional test',insurance:'None'};
 // Execute the actual UI Save Patient handler with API-backed fetch and state setters.
 const source=fs.readFileSync('app/clinic.tsx','utf8');
 const handler=source.slice(source.indexOf('async function savePatient()'),source.indexOf('async function save(e:'));
 const context={form:{...original},patients:[],message:'',busy:false,call:async(url,body)=>{const r=await intake.POST(request(body));const d=await r.json();if(!r.ok)throw new Error(d.error);return d;},setBusy:v=>context.busy=v,setMessage:v=>context.message=v,setPatients:f=>context.patients=f(context.patients),setPatient:()=>{},setPortalPatient:()=>{},setForm:v=>context.form=v,setTab:()=>{}};
 vm.createContext(context);vm.runInContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 await context.savePatient();assert.equal(context.patients.length,1);const saved=JSON.parse(JSON.stringify(context.patients[0]));
 await context.savePatient();assert.equal(context.message,'Duplicate patient record already exists.');assert.equal(context.patients.length,1);
 assert.match(source,/message&&<div role="status" className="notice">\{message\}<\/div>/);
 for(const data of [{...original},{...original,firstName:'  FICTIONAL  ',lastName:' duplicateCHECK ',dob:' 1990-03-14 ',homeAddress:'Must not overwrite'}]){const r=await intake.POST(request(data));assert.equal(r.status,409);assert.equal((await r.json()).error,'Duplicate patient record already exists.');}
 let listed=await (await records.GET()).json();assert.equal(listed.patients.length,1);assert.deepEqual(listed.patients[0],saved);
 sqlite.close();sqlite=new DatabaseSync(path.join(dir,'clinic.sqlite'));
 listed=await (await records.GET()).json();assert.equal(listed.patients.length,1);assert.deepEqual(listed.patients[0],saved);
 assert.equal((await intake.POST(request({...original,dob:'1991-03-14'}))).status,201);
 // Existing patient portal contact updates still work.
 assert.equal((await intake.POST(request({patientId:saved.patientId,dob:saved.dob,gender:saved.gender,homeAddress:saved.homeAddress,phone:saved.phone,email:'updated@example.com'}))).status,201);
 // Two concurrent new intakes result in exactly one save.
 const race=await Promise.all([intake.POST(request({...original,lastName:'Concurrent'})),intake.POST(request({...original,lastName:'Concurrent'}))]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 const fixture=load('lib/clinic.ts').fixtures('TEST-check')[0];
 assert.equal((await accuracy.POST(request(fixture))).status,201);
 assert.equal((await accuracy.POST(request(fixture))).status,409);
 // An additional test event for the same patient remains allowed.
 assert.equal((await accuracy.POST(request({...fixture,date:'2026-10-06'}))).status,201);
 let report=await (await measure.POST()).json();assert.equal(report.report.expected,2);assert.equal(report.report.matched,2);assert.equal(report.report.duplicates,0);assert.equal(report.report.duplicateBlocked,true);
 const {compareAccuracy}=load('lib/accuracy-data.ts');
 const actual=sqlite.prepare('SELECT * FROM records').all().map(load('lib/clinic-db.ts').normalize);
 const expected=(await (await accuracy.GET()).json()).records;
 assert.equal(compareAccuracy(expected,[...actual,{...actual[0],id:'intentional-duplicate'}]).duplicates,1);
 // Emulate a pre-existing duplicate in the isolated test DB, retaining the event
 // index for ongoing repeat-submission protection, and run the full measure route.
 sqlite.exec('DROP INDEX record_event');
 const columns=Object.keys(sqlite.prepare('SELECT * FROM records LIMIT 1').get());
 sqlite.prepare(`INSERT INTO records (${columns.join(',')}) SELECT ${columns.map(c=>c==='id'?"'intentional-duplicate'":c).join(',')} FROM records LIMIT 1`).run();
 sqlite.exec("CREATE UNIQUE INDEX record_event ON records(workspace,patient_id,vaccine,date,dose) WHERE id != 'intentional-duplicate'");
 report=await (await measure.POST()).json();assert.equal(report.report.duplicates,1);assert.equal(report.report.duplicateBlocked,true);
 sqlite.close();sqlite=new DatabaseSync(path.join(dir,'clinic.sqlite'));
 listed=await (await records.GET()).json();assert.equal(listed.report.duplicates,1);assert.equal(listed.report.created,report.report.created);
 assert.equal(listed.patients.filter(p=>p.patientId===saved.patientId).length,1);
 console.log('PASS: UI save handler and warning, one patient entry, normalized duplicate rejection, persisted original fields after DB reopen, contact editing, concurrent save protection, separate test records, repeat protection, duplicate measurement and persisted report.');
 sqlite.close();fs.rmSync(dir,{recursive:true});
})().catch(e=>{console.error(e);process.exitCode=1});
