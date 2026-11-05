import assert from 'node:assert/strict';
import sharp from 'sharp';
import {saveJobPhotos} from '../src/lib/job-photos.ts';
const bytes=await sharp({create:{width:1800,height:1000,channels:3,background:'blue'}}).jpeg().withMetadata().toBuffer();
const file=()=>new File([bytes],'photo.jpg',{type:'image/jpeg'});
function fake({failUpload=0,failRow=0}={}){const uploads=[],rows=[],removed=[],deleted=[];const db={storage:{from(){return {async upload(path,image){uploads.push(path);const m=await sharp(image).metadata();assert.equal(m.format,'webp');assert.ok(m.width<=1600);assert.equal(m.exif,undefined);return {error:uploads.length===failUpload?{}:null};},async remove(paths){removed.push(...paths);return {error:null};}}}},from(){return {async insert(row){rows.push(row);return {error:rows.length===failRow?{}:null};},delete(){return {eq(){return this},async in(k,paths){deleted.push(...paths);return {error:null}}}}}}};return {db,uploads,rows,removed,deleted};}
let f=fake();assert.equal(await saveJobPhotos(f.db,'owner','job',[file(),file()]),true);assert.equal(f.rows.length,2);
f=fake();assert.equal(await saveJobPhotos(f.db,'owner','job',[file(),new File(['bad'],'bad.jpg',{type:'image/jpeg'})]),false);assert.equal(f.uploads.length,0);
f=fake();assert.equal(await saveJobPhotos(f.db,'owner','job',Array.from({length:5},file)),false);assert.equal(f.uploads.length,0);
f=fake();assert.equal(await saveJobPhotos(f.db,'owner','job',[new File([Buffer.alloc(3*1024*1024+1)],'large.jpg',{type:'image/jpeg'})]),false);
f=fake();assert.equal(await saveJobPhotos(f.db,'owner','job',[new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],'fake.jpg',{type:'image/jpeg'})]),false);assert.equal(f.uploads.length,0);
f=fake({failUpload:2});assert.equal(await saveJobPhotos(f.db,'owner','job',[file(),file()]),false);assert.equal(f.removed.length,1);assert.equal(f.deleted.length,1);
f=fake({failRow:2});assert.equal(await saveJobPhotos(f.db,'owner','job',[file(),file()]),false);assert.equal(f.removed.length,2);assert.equal(f.deleted.length,1);
console.log('PASS: photo normalization, spoofed/invalid/oversized/too-many inputs, validation before writes, partial storage/database rollback');
