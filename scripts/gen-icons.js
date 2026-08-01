/*
 * gen-icons.js — genera un .ico multi-tamaño (y un .png 256) desde un PNG fuente.
 * Uso:
 *   node scripts/gen-icons.js <srcPng> <outIco> [outPng]
 * Requiere `sharp` y `png-to-ico` resolvibles (usa NODE_PATH si hace falta).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const [src, outIco, outPng] = process.argv.slice(2);
if (!src || !outIco) {
  console.error('Uso: node gen-icons.js <srcPng> <outIco> [outPng]');
  process.exit(1);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const buffers = await Promise.all(
    sizes.map((s) =>
      sharp(src)
        .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );
  const ico = await pngToIco(buffers);
  fs.mkdirSync(path.dirname(outIco), { recursive: true });
  fs.writeFileSync(outIco, ico);
  console.log('ICO  ->', outIco, `(${ico.length} bytes, ${sizes.length} tamaños)`);

  if (outPng) {
    const png = await sharp(src).resize(256, 256).png().toBuffer();
    fs.mkdirSync(path.dirname(outPng), { recursive: true });
    fs.writeFileSync(outPng, png);
    console.log('PNG  ->', outPng, `(${png.length} bytes)`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
