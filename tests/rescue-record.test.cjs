const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');
const api={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/rescue-record.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api);
test('never auto-selects public and rejects invalid duration',()=>{
 assert.throws(()=>api.rescueRecordRequest('task','25',''));
 for(const m of ['','0','-1','1.5','NaN','1441'])assert.throws(()=>api.rescueRecordRequest('task',m,'public'));
});
test('records actual minutes, no notifications, no workout data',()=>{
 const r=api.rescueRecordRequest(' task ','5','public');assert.equal(r.name,'create_post');assert.equal(r.args.p_content,'task');assert.equal(r.args.p_study_minutes,5);assert.equal(r.args.p_silent,true);assert.equal(r.args.p_workout_minutes,0);
});
test('uses chosen group and neutral text for blank task',()=>{
 const r=api.rescueRecordRequest('','25','group-id');assert.equal(r.name,'create_group_post');assert.equal(r.args.p_group_id,'group-id');assert.equal(r.args.p_content,'今日の課題に取り組みました。');
});
