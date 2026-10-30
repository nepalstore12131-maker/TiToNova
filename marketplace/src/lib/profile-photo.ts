import sharp from 'sharp';
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export async function prepareProfilePhoto(bytes: Uint8Array) {
 if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('photo-invalid');
 const image = sharp(bytes, {limitInputPixels:16000000, animated:false, failOn:'warning'});
 const meta = await image.metadata();
 if (!['jpeg','png','webp'].includes(meta.format||'') || (meta.pages||1)>1) throw new Error('photo-invalid');
 // Re-encoding strips EXIF/location data and prevents executable uploads.
 return image.rotate().resize(512,512,{fit:'cover',position:'centre',withoutEnlargement:true}).webp({quality:88}).toBuffer();
}
