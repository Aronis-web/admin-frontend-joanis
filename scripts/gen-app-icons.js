/*
 * gen-app-icons.js — genera 3 iconos DISTINTOS (PNG 1024 + .ico multi-tamaño):
 *   - admin   (ERP-aio):  dashboard/analytics  · morado → azul
 *   - caja    (CajaGrit):  tarjeta de pago POS  · verde esmeralda → teal
 *   - release (Release Tool): cohete/deploy     · ámbar → naranja
 *
 * Rasteriza SVG con sharp y empaqueta el .ico con png-to-ico.
 * Ejecutar con NODE_PATH apuntando a un node_modules con `sharp` + `png-to-ico`.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

const ADMIN = 'C:/Users/aaron/IdeaProjects/admin-frontend-joanis';
const CAJA = 'C:/Users/aaron/IdeaProjects/caja-frontend-joanis';

// --- ADMIN: panel con barras + línea de tendencia (analytics) ---------------
const adminSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="64" y1="64" x2="960" y2="960" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#D946EF"/>
      <stop offset="0.5" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="210" fill="url(#bg)"/>
  <rect x="238" y="270" width="548" height="430" rx="46" fill="#FFFFFF" opacity="0.16"/>
  <rect x="316" y="540" width="80" height="132" rx="22" fill="#FFFFFF"/>
  <rect x="432" y="470" width="80" height="202" rx="22" fill="#FFFFFF"/>
  <rect x="548" y="404" width="80" height="268" rx="22" fill="#FFFFFF"/>
  <polyline points="330,470 472,402 612,336 700,298" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity="0.96"/>
  <circle cx="700" cy="298" r="30" fill="#FFFFFF"/>
</svg>`;

// --- CAJA: tarjeta de pago con banda, chip y ondas contactless --------------
const cajaSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="64" y1="64" x2="960" y2="960" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#34D399"/>
      <stop offset="0.55" stop-color="#10B981"/>
      <stop offset="1" stop-color="#0D9488"/>
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="210" fill="url(#bg)"/>
  <rect x="252" y="336" width="520" height="352" rx="44" fill="#FFFFFF"/>
  <rect x="252" y="398" width="520" height="66" fill="#0F766E"/>
  <rect x="300" y="546" width="140" height="86" rx="18" fill="#F59E0B"/>
  <rect x="300" y="546" width="140" height="86" rx="18" fill="none" stroke="#D97706" stroke-width="6"/>
  <line x1="370" y1="546" x2="370" y2="632" stroke="#D97706" stroke-width="6"/>
  <line x1="300" y1="589" x2="440" y2="589" stroke="#D97706" stroke-width="6"/>
  <path d="M556 546 a48 48 0 0 1 0 86" fill="none" stroke="#0D9488" stroke-width="14" stroke-linecap="round"/>
  <path d="M596 528 a80 80 0 0 1 0 122" fill="none" stroke="#0D9488" stroke-width="14" stroke-linecap="round" opacity="0.7"/>
</svg>`;

// --- RELEASE: cohete despegando (deploy) ------------------------------------
const releaseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="64" y1="64" x2="960" y2="960" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FBBF24"/>
      <stop offset="0.55" stop-color="#F97316"/>
      <stop offset="1" stop-color="#EA580C"/>
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="210" fill="url(#bg)"/>
  <path d="M512 706 C 466 648 466 604 512 566 C 558 604 558 648 512 706 Z" fill="#FEF3C7"/>
  <path d="M512 690 C 486 652 486 620 512 592 C 538 620 538 652 512 690 Z" fill="#FFFFFF"/>
  <path d="M420 528 L 360 632 L 434 598 Z" fill="#EA580C"/>
  <path d="M604 528 L 664 632 L 590 598 Z" fill="#EA580C"/>
  <path d="M512 292 C 600 356 620 486 598 596 L 426 596 C 404 486 424 356 512 292 Z" fill="#FFFFFF"/>
  <circle cx="512" cy="432" r="54" fill="#0EA5E9"/>
  <circle cx="512" cy="432" r="54" fill="none" stroke="#CBD5E1" stroke-width="12"/>
</svg>`;

const sizes = [16, 24, 32, 48, 64, 128, 256];

const targets = [
  {
    name: 'admin',
    svg: adminSvg,
    png: `${ADMIN}/assets/icon.png`,
    ico: `${ADMIN}/electron/build/icon.ico`,
    icoPng: `${ADMIN}/electron/build/icon.png`,
  },
  {
    name: 'caja',
    svg: cajaSvg,
    png: `${CAJA}/assets/icon.png`,
    ico: `${CAJA}/assets/icon.ico`,
  },
  {
    name: 'release',
    svg: releaseSvg,
    png: `${ADMIN}/build-tool/icon.png`,
    ico: `${ADMIN}/build-tool/icon.ico`,
  },
];

(async () => {
  for (const t of targets) {
    const buf = Buffer.from(t.svg);

    // PNG fuente 1024x1024
    fs.mkdirSync(path.dirname(t.png), { recursive: true });
    await sharp(buf).resize(1024, 1024).png().toFile(t.png);
    console.log('PNG  ->', t.png);

    // .ico multi-tamaño
    const buffers = await Promise.all(
      sizes.map((s) => sharp(Buffer.from(t.svg)).resize(s, s).png().toBuffer())
    );
    const ico = await pngToIco(buffers);
    fs.mkdirSync(path.dirname(t.ico), { recursive: true });
    fs.writeFileSync(t.ico, ico);
    console.log('ICO  ->', t.ico, `(${ico.length} bytes)`);

    // PNG 256 auxiliar (para main.js de admin)
    if (t.icoPng) {
      await sharp(Buffer.from(t.svg)).resize(256, 256).png().toFile(t.icoPng);
      console.log('PNG  ->', t.icoPng);
    }
  }
  console.log('\nOK: 3 iconos generados.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
