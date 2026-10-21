// Exercise the actual route and SQL against a temporary in-memory database.
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE patients(patient_id TEXT PRIMARY KEY,workspace TEXT,name TEXT,dob TEXT,data TEXT,UNIQUE(workspace,name,dob));
CREATE TABLE records(id TEXT PRIMARY KEY,workspace TEXT,patient_id TEXT,name TEXT,dob TEXT,first_name TEXT,last_name TEXT,gender TEXT,home_address TEXT,phone TEXT,email TEXT,needs TEXT,vaccine TEXT,date TEXT,dose TEXT,provider TEXT,manufacturer TEXT,lot_number TEXT,cost INTEGER,insurance TEXT);`);
const database={prepare(query){return {bind(...values){return statement(query,values)},...statement(query,[])}} ,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
function statement(query,values){return {query,values,all:async()=>({results:sql.prepare(query).all(...values)}),first:async()=>sql.prepare(query).get(...values)||null,run:()=>({meta:{changes:Number(sql.prepare(query).run(...values).changes)}})}}
const cache={};let currentWorkspace='workspace-a';
function load(filename){filename=path.resolve(filename);if(cache[filename])return cache[filename].exports;const module={exports:{}};cache[filename]=module;
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=(name)=>{if(name==='cloudflare:workers')return {env:{DB:database}};if(name==='@/app/api/records/route')return {workspace:async()=>currentWorkspace};if(name.startsWith('@/'))return load(path.join(root,name.slice(2)+'.ts'));if(name.startsWith('.'))return load(path.resolve(path.dirname(filename),name+'.ts'));return require(name);};
 vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,console,Response,Request,crypto,TextEncoder,Date},{filename});return module.exports;}
const {POST}=load(path.join(root,'app/api/patient-intake/route.ts'));
const original={firstName:'Alex',lastName:'Example',dob:'2000-01-01',gender:'Male',homeAddress:'1 Demo Street',phone:'305-555-0101',email:'alex@example.com',needs:'Routine visit',insurance:'Demo coverage'};
async function post(data){const r=await POST(new Request('https://clinic.example/api/patient-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));return {status:r.status,body:await r.json()};}
(async()=>{
 const created=await post(original);assert.equal(created.status,201);const patientId=created.body.patientId;
 sql.prepare('INSERT INTO records(id,workspace,patient_id,name,dob,first_name,last_name,vaccine,date,dose,lot_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('vax1','workspace-a',patientId,'Alex Example',original.dob,'Alex','Example','Demo vaccine','2026-10-05','1','LOT-01');
 sql.prepare('INSERT INTO records(id,workspace,patient_id,name,dob,vaccine) VALUES(?,?,?,?,?,?)').run('test1','workspace-a','TEST-001','Alex Example',original.dob,'Test vaccine');
 const changed={...original,mode:'update',patientId,firstName:'Alexandra',dob:'2000-02-02',phone:'305-555-0199',email:'new@example.com',insurance:'Updated coverage',needs:'Updated visit'};
 const saved=await post(changed);assert.equal(saved.status,200);assert.equal(saved.body.patientId,patientId);
 let profiles=sql.prepare('SELECT * FROM patients').all();assert.equal(profiles.length,1);assert.equal(profiles[0].name,'alexandra example');assert.equal(JSON.parse(profiles[0].data).insurance,'Updated coverage');
 const record=sql.prepare('SELECT * FROM records WHERE id=?').get('vax1');assert.equal(record.patient_id,patientId);assert.equal(record.name,'Alexandra Example');assert.equal(record.dob,changed.dob);assert.equal(record.phone,changed.phone);assert.equal(record.vaccine,'Demo vaccine');assert.equal(record.lot_number,'LOT-01');assert.equal(sql.prepare('SELECT name FROM records WHERE id=?').get('test1').name,'Alex Example');
 assert.equal((await post({...changed,dob:'2999-01-01'})).status,400);
 assert.equal((await post({...changed,patientId:'missing'})).status,404);
 const other=await post({...original,firstName:'Morgan'});assert.equal(other.status,201);
 assert.equal((await post({...changed,firstName:'Morgan',dob:original.dob})).status,409);
 assert.equal((await post({...changed,mode:undefined,patientId:undefined})).status,409);
 currentWorkspace='workspace-b';assert.equal((await post(changed)).status,404);
 currentWorkspace='workspace-a';const contact={patientId,dob:changed.dob,gender:changed.gender,homeAddress:changed.homeAddress,phone:'305-555-0144',email:changed.email};assert.equal((await post(contact)).status,201);assert.equal(sql.prepare('SELECT phone FROM records WHERE id=?').get('vax1').phone,contact.phone);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM patients').get().n,2);
 console.log('Patient edit checks passed: saved changes, stable ID, linked history, unchanged vaccine fields, validation, duplicate prevention, workspace isolation, and contact update compatibility.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>sql.close());
