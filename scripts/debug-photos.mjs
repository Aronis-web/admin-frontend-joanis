// Debug: ¿hay productos duplicados con sku 2025-252 / barcode 9004378926116
// y alguno de ellos tiene las fotos de referencia?
const BASE = 'https://api.app-joanis-backend.com';
const APP_ID = 'e28208b8-89b4-4682-80dc-925059424b1f';
const EMAIL = 'admin@example.com';
const PASSWORD = 'Hola4321';
const COMPANY = 'cf894123-13ae-4a14-9efe-c480622f841c'; // Grit Labs Sac
const CAMP = 'c398fc41-3fe5-407f-8aa0-2d13aef2759c';

let token = null;
const headers = () => ({
  'Content-Type': 'application/json',
  'X-App-Id': APP_ID,
  'X-App-Version': '1.0.0',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'X-Company-Id': COMPANY,
});
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`, { headers: headers() });
  const t = await r.text();
  let b;
  try {
    b = JSON.parse(t);
  } catch {
    b = t;
  }
  return { status: r.status, body: b };
};

async function main() {
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  token = (await lr.json()).accessToken;
  console.log('login', lr.status);

  // Buscar por sku y por barcode en el catálogo
  for (const q of ['2025-252', '9004378926116', 'VALDE TRANSPARENTE']) {
    const r = await get(`/admin/products?search=${encodeURIComponent(q)}&limit=50`);
    const arr = r.body?.products || r.body?.items || r.body?.data || (Array.isArray(r.body) ? r.body : []);
    console.log(`\n=== search "${q}" -> ${arr.length} resultados ===`);
    for (const p of arr) {
      console.log(`  ${p.id}  sku=${p.sku}  barcode=${p.barcode}  "${p.title}"  created=${p.createdAt}`);
    }
  }

  // Listar TODOS los productos del photo-campaign y filtrar por sku 2025-252 o titulo VALDE
  let page = 1;
  const matches = [];
  for (;;) {
    const r = await get(`/admin/photo-campaigns/${CAMP}/products?limit=200&page=${page}`);
    const items = Array.isArray(r.body) ? r.body : r.body?.items || r.body?.data || [];
    if (!items.length) break;
    for (const it of items) {
      const p = it.product || {};
      if (
        (p.sku && String(p.sku).includes('2025-252')) ||
        (p.barcode && String(p.barcode).includes('9004378926116')) ||
        (p.title && p.title.toUpperCase().includes('VALDE'))
      ) {
        matches.push(it);
      }
    }
    if (items.length < 200) break;
    page += 1;
  }
  console.log(`\n=== items del photo-campaign que matchean VALDE/2025-252: ${matches.length} ===`);
  for (const it of matches) {
    const pid = it.productId || it.product?.id;
    const f = await get(`/admin/photo-campaigns/products/${pid}/photos`);
    const fl = Array.isArray(f.body) ? f.body : [];
    console.log(`  pid=${pid} sku=${it.product?.sku} "${it.product?.title}" -> ${fl.length} fotos [${fl.map((x) => x.photoType).join(', ')}]`);
  }
}
main().catch((e) => console.error('FATAL', e));
