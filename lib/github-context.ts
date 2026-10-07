import {AsyncLocalStorage} from "node:async_hooks";
const context=new AsyncLocalStorage<string>();
export const githubWorkspace=()=>context.getStore();
export const withGithubWorkspace=<T>(key:string,run:()=>T)=>context.run("github-demo:"+key,run);
