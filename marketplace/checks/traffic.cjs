const assert=require('node:assert/strict');
(async()=>{const {trafficPage,trafficSource,growthLabel}=await import('../src/lib/traffic.ts');
for(const path of ['/admin','/admin/notices','/auth/callback','/reset-password','/unknown'])assert.equal(trafficPage(path),null);
assert.equal(trafficPage('/dashboard/support/private-id'),'Workspace');assert.equal(trafficPage('/jobs/private-id'),'Job details');
assert.equal(trafficSource('https://www.tiktok.com/user?secret=x'),'TikTok');assert.equal(trafficSource('https://tiktok.com.evil.example'),'Other website');assert.equal(trafficSource('https://www.titonova.com/dashboard'),'Direct / unknown');assert.equal(trafficSource(''),'Direct / unknown');
assert.equal(growthLabel(3,2),'+50.0% vs previous period');assert.equal(growthLabel(0,0),'No change');assert.equal(growthLabel(5,0),'New activity · no previous baseline');
console.log('PASS: private paths excluded/grouped, source hostname boundaries, growth math and zero baseline');})();
