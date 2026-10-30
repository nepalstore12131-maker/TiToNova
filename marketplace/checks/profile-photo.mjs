import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareProfilePhoto,MAX_PHOTO_BYTES} from '../src/lib/profile-photo.ts';
for (const format of ['jpeg','png','webp']) {
 const source=await sharp({create:{width:800,height:600,channels:3,background:'#c5a454'}})[format]().withMetadata().toBuffer();
 const output=await prepareProfilePhoto(source);const meta=await sharp(output).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,512);assert.equal(meta.height,512);assert.equal(meta.exif,undefined);assert.ok(output.length<1048576);
}
await assert.rejects(()=>prepareProfilePhoto(Buffer.from('not an image')));
await assert.rejects(()=>prepareProfilePhoto(Buffer.alloc(MAX_PHOTO_BYTES+1)));
await assert.rejects(()=>prepareProfilePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
const huge=await sharp({create:{width:5000,height:4000,channels:3,background:'white'}}).png().toBuffer();
await assert.rejects(()=>prepareProfilePhoto(huge));
console.log('PASS: JPG/PNG/WebP normalized, 512px, metadata stripped, invalid/SVG/oversized/large-pixel inputs rejected');
