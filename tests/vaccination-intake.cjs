/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- CJS harness loads isolated TypeScript route modules, matching existing integration tests. */
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
let currentWorkspace='qa-989';
const cache=new Map();
function load(file){file=path.resolve(file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const req=id=>id==='cloudflare:workers'?{env:{DB}}:id==='next/headers'?{headers:async()=>new Headers({'oai-authenticated-user-id':currentWorkspace})}:id.startsWith('@/')?load(path.join(root,id.slice(2))):id.startsWith('.')?load(path.resolve(path.dirname(file),id)):require(id);new Function('require','module','exports',js)(req,module,module.exports);return module.exports;}
const intake=load('app/api/patient-intake/route.ts'),records=load('app/api/records/route.ts');
const request=data=>new Request('http://test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
(async()=>{
 const original={firstName:'QAFictional',lastName:'Card989',dob:'1990-04-12',gender:'',homeAddress:'989 Fictional Lane',phone:'202-555-0198',email:'qa989@example.invalid',needs:'',insurance:'No insurance'};
 const shot={...original,vaccine:'Example Vaccine A',date:'2026-09-01',dose:'1',provider:'Fictional Staff',description:'Synthetic test',lotNumber:'QA989-A',manufacturer:'Fictional Maker',city:'Testville',state:'FL',cost:0};
 const post=(route,data)=>route.POST(request(data));
 const snapshot=()=>JSON.stringify({patients:sqlite.prepare('SELECT * FROM patients ORDER BY patient_id').all(),records:sqlite.prepare('SELECT * FROM records ORDER BY id').all(),accuracy:sqlite.prepare('SELECT * FROM accuracy_expected ORDER BY id').all()});
 const created=await post(intake,original);assert.equal(created.status,201);const patientId=(await created.json()).patientId;
 const baseline=snapshot();
 // This is the report's alternate save path, bypassing the intake endpoint.
 for(const data of [{...shot,email:'changed@example.invalid',homeAddress:'Changed Fictional Lane'}, {...shot,firstName:' QAFICTIONAL ',lastName:' card989 ',dob:' 1990-04-12 '}]){
  const rejected=await post(records,data);assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'DUPLICATE_PATIENT');assert.equal(snapshot(),baseline);
 }
 // Explicit selection cannot be used as a hidden contact-edit operation.
 let rejected=await post(records,{...shot,patientId,email:'changed@example.invalid'});assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'PATIENT_DETAILS_CHANGED');assert.equal(snapshot(),baseline);
 assert.equal((await post(records,{...shot,patientId:'missing'})).status,400);assert.equal(snapshot(),baseline);
 for(const field of ['firstName','lastName','dob','homeAddress','phone','email','vaccine','lotNumber','manufacturer','date','dose','provider','city','state','description']){
  assert.equal((await post(records,{...shot,patientId,[field]:''})).status,400,field);assert.equal(snapshot(),baseline);
 }
 assert.equal((await post(records,{...shot,patientId})).status,201);
 const afterFirst=snapshot();
 for(const date of ['2026-09-01','2026-09-30','2026-08-03']){
  rejected=await post(records,{...shot,patientId,date,dose:'2',lotNumber:'QA989-B',manufacturer:'Different Fictional Maker'});assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'VACCINE_TOO_SOON');assert.equal(snapshot(),afterFirst);
 }
 assert.equal((await post(records,{...shot,patientId,date:'2026-10-01',dose:'2'})).status,201);
 assert.equal((await post(records,{...shot,patientId,vaccine:'Different Example Vaccine'})).status,201);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM records').get().n,3);
 assert.deepEqual(JSON.parse(sqlite.prepare('SELECT data FROM patients WHERE patient_id=?').get(patientId).data),{...original,name:original.firstName+' '+original.lastName,patientId});
 // A new patient and their first vaccination commit together.
 assert.equal((await post(records,{...shot,lastName:'NewPatient'})).status,201);
 // Competing new-patient saves: loser must not leave records or snapshots.
 const race=await Promise.all([post(records,{...shot,lastName:'Concurrent'}),post(records,{...shot,lastName:'Concurrent',date:'2026-11-01'})]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM records WHERE last_name='Concurrent'").get().n,1);
 const beforeFailure=snapshot();
 sqlite.exec("CREATE TRIGGER fail_qa_record BEFORE INSERT ON records WHEN NEW.last_name='Rollback' BEGIN SELECT RAISE(ABORT, 'forced test write failure'); END");
 assert.equal((await post(records,{...shot,lastName:'Rollback'})).status,503);assert.equal(snapshot(),beforeFailure);
 // Workspace isolation: same identity is a new patient in another workspace.
 currentWorkspace='qa-989-other';assert.equal((await post(records,shot)).status,201);
 // Real step-one handler blocks duplicate continuation, but allows explicit selection.
 const source=fs.readFileSync('app/clinic.tsx','utf8');
 const handler=source.slice(source.indexOf('function continueToVaccination('),source.indexOf('function sample()'));
 const ctx={accuracyEntry:false,form:{patientId:''},matchingPatient:{patientId},message:'',step:1,setMessage:v=>ctx.message=v,setIntakeStep:v=>ctx.step=v};
 vm.createContext(ctx);vm.runInContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 const event={preventDefault(){},currentTarget:{reportValidity:()=>true}};
 ctx.continueToVaccination(event);assert.equal(ctx.step,1);assert.match(ctx.message,/Duplicate patient/);
 ctx.form.patientId=patientId;ctx.continueToVaccination(event);assert.equal(ctx.step,2);
 ctx.step=1;ctx.form.patientId='';ctx.matchingPatient=undefined;ctx.continueToVaccination(event);assert.equal(ctx.step,2);
 console.log('PASS: alternate-path duplicate rejection, unchanged profiles/history/snapshots, required fields, explicit selection, spacing boundaries, different vaccine, new patient, concurrency, atomic rollback, workspace isolation, and UI continuation.');
 sqlite.close();fs.rmSync(dir,{recursive:true});
})().catch(e=>{console.error(e);process.exitCode=1});
