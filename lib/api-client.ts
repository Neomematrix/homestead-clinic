// GitHub Pages serves the interface; the existing clinic Worker owns all data.
const backend="https://clinic-record-accuracy.kyle-george-1801.chatgpt.site";
export function clinicFetch(path:string,init:RequestInit={}){
 const github=location.hostname==="neomematrix.github.io";
 if(!github)return fetch(path,init);
 const storageKey="homestead-clinic-workspace-v1";
 let key=localStorage.getItem(storageKey);
 if(!key){key=crypto.randomUUID();localStorage.setItem(storageKey,key);}
 const headers=new Headers(init.headers);headers.set("X-Clinic-Demo-Key",key);
 return fetch(backend+"/api/github/"+path.replace(/^\/api\//,""),{...init,headers,credentials:"omit"});
}
