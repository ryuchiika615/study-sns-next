const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const api={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/auth-next.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
test('rescue entry and group invitations survive login',()=>{
 assert.equal(api.safeAuthNext('/start/rescue'),'/start/rescue');
 assert.equal(api.safeAuthNext('/groups/abc?invite=code'),'/groups/abc?invite=code');
});
test('reject off-site, backslash, auth loops and control characters',()=>{
 for(const input of ['https://evil.test','//evil.test','/\\evil.test','/auth/login','/foo/../auth/signup','/\nevil'])assert.equal(api.safeAuthNext(input),'/');
});
test('normal login and callback retain their defaults',()=>{
 assert.equal(api.safeAuthNext(null),'/');assert.equal(api.safeAuthNext(null,'/settings'),'/settings');
});
