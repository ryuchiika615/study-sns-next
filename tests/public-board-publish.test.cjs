const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/public-board-publish.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
new Function('exports', compiled)(exported);
const { publishPublicBoardPost } = exported;
const input = {category:'グループ募集',content:' 募集します ',groupId:'owned-group',imageUrl:null};
function client(error=null){const calls=[];return {calls,rpc:async(name,args)=>{calls.push({name,args});return {data:{post_id:'post'},error};}};}

test('recruitment uses one atomic RPC, not insert then attach',async()=>{
  const c=client();await publishPublicBoardPost(c,input);
  assert.deepEqual(c.calls,[{name:'create_group_recruitment_post',args:{p_group_id:'owned-group',p_content:'募集します',p_image_url:null}}]);
});
test('missing SQL is readable and never falls back to creating an orphan post',async()=>{
  const c=client({code:'PGRST202',message:'Could not find the function'});
  await assert.rejects(publishPublicBoardPost(c,input),/データベース更新（0123）/);
  assert.equal(c.calls.length,1);
});
test('normal board categories retain existing create_post payload',async()=>{
  const c=client();await publishPublicBoardPost(c,{...input,category:'質問',groupId:'',imageUrl:'https://example.test/image.jpg'});
  assert.equal(c.calls[0].name,'create_post');assert.equal(c.calls[0].args.p_subject,'質問');
  assert.deepEqual(c.calls[0].args.p_image_urls,['https://example.test/image.jpg']);
});
test('invalid content or missing group does not issue a database call',async()=>{
  for(const override of [{content:' '},{content:'a'.repeat(2001)},{groupId:''}]){
    const c=client();await assert.rejects(publishPublicBoardPost(c,{...input,...override}));assert.equal(c.calls.length,0);
  }
});
test('ownership and other server errors remain failures',async()=>{
  const c=client({message:'自分が作成したグループだけを募集できます'});
  await assert.rejects(publishPublicBoardPost(c,input),/自分が作成した/);assert.equal(c.calls.length,1);
});
