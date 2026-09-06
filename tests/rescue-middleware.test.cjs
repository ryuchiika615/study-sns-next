const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');
function load(file,requireFn){const api={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(api,requireFn);return api;}
const nextHelper=load('src/lib/auth-next.ts',require);
function setup(user){let authCalls=0;const mock={auth:{getUser:async()=>{authCalls++;return {data:{user}};}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{is_banned:false}})})})})};
 const api=load('src/middleware.ts',name=>name==='@/lib/auth-next'?nextHelper:name==='@supabase/ssr'?{createServerClient:()=>mock}:{NextResponse:{next:()=>({kind:'next',cookies:{set(){}}}),redirect:url=>({kind:'redirect',url:String(url)})}});
 return {middleware:api.middleware,authCalls:()=>authCalls};
}
function request(path){const url=new URL(path,'https://example.test');url.clone=()=>new URL(url);return {url:String(url),nextUrl:url,cookies:{getAll:()=>[],set(){}}};}
test('free download requires neither an account nor an auth-service request',async()=>{
 const c=setup(null);assert.equal((await c.middleware(request('/downloads/ryutter-deadline-rescue.xlsx'))).kind,'next');assert.equal(c.authCalls(),0);
});
test('sheet entry keeps destination when login is required',async()=>{
 const c=setup(null);const r=await c.middleware(request('/start/rescue'));assert.equal(new URL(r.url).searchParams.get('next'),'/start/rescue');
});
test('existing accounts bypass signup and arrive at rescue',async()=>{
 const c=setup({id:'user'});const r=await c.middleware(request('/auth/signup?next=%2Fstart%2Frescue'));assert.equal(r.url,'https://example.test/start/rescue');
});
