const assert = require('node:assert/strict');
(async()=>{
const {safeAuthDestination:next,canonicalSiteUrl:canonical} = await import('../src/lib/auth-navigation.ts');
for (const value of [undefined,'https://evil.example','//evil.example','/\\evil.example','/login','/admin/login?next=/admin','/signup','/auth/callback','/%6cogin','/%ZZ']) assert.equal(next(value),'/dashboard',String(value));
assert.equal(next('/dashboard/messages?tab=unread#latest'),'/dashboard/messages?tab=unread#latest');
assert.equal(canonical('https://titonova.vercel.app/jobs?q=designer'),'https://www.titonova.com/jobs?q=designer');
assert.equal(canonical('https://titonova.com/dashboard/profile','HEAD'),'https://www.titonova.com/dashboard/profile');
for (const host of ['www.titonova.com','localhost:3100','titonova-preview.vercel.app','titonova.com.evil.example']) assert.equal(canonical(`https://${host}/login`),null);
assert.equal(canonical('https://titonova.vercel.app/login','POST'),null);
console.log('PASS: safe return paths, auth-loop prevention, canonical host/path/query and preview isolation');

})().catch(error=>{console.error(error);process.exitCode=1;});
