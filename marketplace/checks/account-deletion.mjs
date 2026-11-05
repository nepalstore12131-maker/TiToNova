import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync('src/lib/account-deletion.ts','utf8');
const {deleteAccountWithFiles}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
function mock({lookup=false,storage=false,auth=false,count=201}={}){
 const calls=[];
 return {calls,client:{rpc:async()=>{calls.push('list');return {data:Array.from({length:count},(_,i)=>({bucket_id:'job-photos',object_name:'target/'+i})),error:lookup?{code:'lookup'}:null}},storage:{from:bucket=>({remove:async paths=>{calls.push({bucket,paths});return {error:storage?{message:'storage'}:null}}})},auth:{admin:{deleteUser:async id=>{calls.push({delete:id});return {error:auth?{code:'auth'}:null}}}}}};
}
let m=mock();assert.equal((await deleteAccountWithFiles(m.client,'target')).error,null);assert.deepEqual(m.calls.filter(c=>c.paths).map(c=>c.paths.length),[100,100,1]);assert.deepEqual(m.calls.at(-1),{delete:'target'});
for(const options of [{lookup:true},{storage:true}]){m=mock(options);assert.ok((await deleteAccountWithFiles(m.client,'target')).error);assert.equal(m.calls.some(c=>c.delete),false);}
m=mock({count:0});assert.equal((await deleteAccountWithFiles(m.client,'target')).error,null);assert.equal(m.calls.length,2);
m=mock({auth:true});assert.equal((await deleteAccountWithFiles(m.client,'target')).stage,'account');
const action=readFileSync('src/app/admin/users/actions.ts','utf8').split('export async function adminDeleteAccount')[1].split('/**')[0];
assert.ok(action.indexOf('requireAdminContext')<action.indexOf('deleteAccountWithFiles'));
assert.ok(action.includes('confirmation !== "DELETE"')&&action.includes('id === adminUser.id')&&action.includes('count ?? 0'));
console.log('PASS: upload cleanup chunks, no auth deletion after cleanup errors, empty upload case, auth failure reporting, admin/confirmation/self/last-admin guards. No real accounts deleted.');
