// validate-ui.cjs — Validación visual con Playwright
// Ejecutar: node validate-ui.cjs  (o: npm run test:ui)
// Requiere: .env.qa con QA_EMAIL, QA_PASSWORD, QA_TENANT (ver .env.qa.example)
// Requiere: servidor dev activo en QA_BASE_URL (npm run dev)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Carga .env.qa si existe (sin dependencia de dotenv)
const envQaPath = path.join(__dirname, '.env.qa');
if (fs.existsSync(envQaPath)) {
  fs.readFileSync(envQaPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const sep = trimmed.indexOf('=');
    if (sep < 1) return;
    const key = trimmed.slice(0, sep).trim();
    const val = trimmed.slice(sep + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

const BASE     = process.env.QA_BASE_URL || 'http://localhost:5173';
const EMAIL    = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const TENANT   = process.env.QA_TENANT;

if (!EMAIL || !PASSWORD || !TENANT) {
  console.error('\nError: Faltan credenciales QA.');
  console.error('Copia .env.qa.example a .env.qa y completa los valores.\n');
  process.exit(1);
}

const OUT = path.join(__dirname, 'validate-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Rutas a validar con eyebrow y título esperados.
// OJO: estos valores deben calzar con lo que cada componente hardcodea de verdad
// (Gestion.jsx PAGE_META, Biomasa.jsx, Historial.jsx, Centros.jsx) — no con un
// diseño aspiracional. Si cambian las categorías reales, actualizar aquí.
const ROUTES = [
  { path: '/dashboard',                         key: '01-dashboard',    eyebrow: 'Inicio · Panel Ejecutivo',  title: 'Panel Principal' },
  { path: '/gestion/bandeja',                   key: '02-bandeja',      eyebrow: 'Inicio · Resumen',          title: 'Resumen Operativo' },
  { path: '/gestion/agenda',                    key: '03-agenda',       eyebrow: 'Directorio · Agenda',       title: 'Agenda Operacional' },
  // /gestion/tratos, /biomasa/programa y /biomasa/muestreos son pestañas del
  // mismo hub Biomasa.jsx: un solo header "Operaciones · Biomasa" para las 3.
  { path: '/biomasa/tratos',                    key: '04-tratos',       eyebrow: 'Operaciones · Biomasa',     title: 'Biomasa' },
  { path: '/biomasa/programa',                  key: '05-programa',     eyebrow: 'Operaciones · Biomasa',     title: 'Biomasa' },
  { path: '/biomasa/muestreos',                 key: '06-muestreos',    eyebrow: 'Operaciones · Biomasa',     title: 'Biomasa' },
  { path: '/gestion/proveedores',               key: '07-proveedores',  eyebrow: 'Directorio · Proveedores',  title: 'Directorio de Proveedores' },
  { path: '/historial',                         key: '08-historial',    eyebrow: 'Trazabilidad · Historial',  title: 'Historial operativo' },
  { path: '/historial?proveedor=algemarin-spa', key: '09-expediente',   eyebrow: 'Trazabilidad · Historial',  title: null },
  { path: '/centros/directorio',                key: '10-centros',      eyebrow: 'Directorio · Centros',      title: 'Directorio de Centros' },
  { path: '/centros/mapa',                      key: '11-centros-mapa', eyebrow: 'Directorio · Mapa',         title: 'Mapa de Centros' },
  { path: '/centros/sanitario',                 key: '12-sanitario',    eyebrow: 'Trazabilidad · Sanitario',  title: 'Estado Sanitario' },
];

const results = [];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Login
  console.log(`[1] Login → ${BASE}/login`);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: 10000 });
  await page.locator('input[type=email]').fill(EMAIL);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();

  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  } catch {
    const err = await page.textContent('.login-error-alert').catch(() => 'sin mensaje');
    console.error(`    LOGIN FALLIDO: ${err}`);
    await page.screenshot({ path: `${OUT}/00-login-failed.png` });
    await browser.close();
    process.exit(1);
  }
  console.log(`    OK → ${page.url()}`);

  // Seleccionar tenant (superadmin)
  console.log(`[2] Tenant: ${TENANT}`);
  await page.evaluate(db => {
    localStorage.setItem('selected_tenant_db', db);
  }, TENANT);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Validar sidebar
  const sidebarLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.mx-submenu a')).map(a => a.textContent.trim()).filter(Boolean)
  );
  const sidebarChecks = {
    // "Tratos" ya no es un link propio: vive como pestaña dentro de Biomasa.
    hasBiomasa:    sidebarLinks.some(l => l === 'Biomasa'),
    hasNeg:        sidebarLinks.some(l => l === 'Negociación'),
    hasHistorial:  sidebarLinks.some(l => l === 'Historial'),
    hasHistEquipo: sidebarLinks.some(l => l.includes('Historial / Equipo')),
  };
  const sidebarOk = sidebarChecks.hasBiomasa && sidebarChecks.hasHistorial && !sidebarChecks.hasNeg && !sidebarChecks.hasHistEquipo;
  console.log(`    sidebar: [${sidebarLinks.join(', ')}]`);
  results.push({ key: 'sidebar', status: sidebarOk ? 'PASS' : 'FAIL', ...sidebarChecks });

  // Validar rutas
  for (const route of ROUTES) {
    process.stdout.write(`[→] ${route.path} ... `);
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await page.screenshot({ path: `${OUT}/${route.key}.png`, fullPage: false });

    const isOnLogin  = page.url().includes('/login');
    const eyebrowText = await page.textContent('.mx-eyebrow').catch(() => '');
    const h1Text      = await page.textContent('.mx-hero h1').catch(() => '');
    const heroH       = await page.evaluate(() => { const h = document.querySelector('.mx-hero'); return h ? Math.round(h.getBoundingClientRect().height) : null; }).catch(() => null);
    const contentPT   = await page.evaluate(() => { const c = document.querySelector('.mx-content-frame'); return c ? window.getComputedStyle(c).paddingTop : null; }).catch(() => null);
    const bodyPB      = await page.evaluate(() => window.getComputedStyle(document.body).paddingBottom).catch(() => null);
    const heroClass   = await page.evaluate(() => document.querySelector('.mx-hero')?.className || '').catch(() => '');
    const fabY        = await page.evaluate(() => {
      const fab = Array.from(document.querySelectorAll('button')).find(b => window.getComputedStyle(b).position === 'fixed' && b.textContent.includes('Acción rápida'));
      return fab ? Math.round(fab.getBoundingClientRect().top) : null;
    }).catch(() => null);

    const hasWrongSep  = eyebrowText.includes(' - ');
    const eyebrowMatch = !route.eyebrow || eyebrowText.trim() === route.eyebrow;
    const hasWithDesc  = heroClass.includes('mx-hero--with-desc');

    const status = isOnLogin ? 'FAIL-AUTH' : hasWrongSep ? 'FAIL-SEP' : !eyebrowMatch ? 'WARN-EYEBROW' : 'PASS';
    results.push({
      key: route.key, path: route.path, status, isOnLogin,
      eyebrow: { text: eyebrowText.trim(), expected: route.eyebrow, match: eyebrowMatch, wrongSep: hasWrongSep },
      h1: h1Text.trim().substring(0, 80),
      layout: { heroH: heroH + 'px', heroVariant: hasWithDesc ? 'with-desc' : 'compact', contentPadTop: contentPT, bodyPadBottom: bodyPB, fabY: fabY != null ? fabY + 'px' : 'hidden' },
    });
    console.log(`${status} | ey="${eyebrowText.trim().substring(0, 38)}" | hero=${heroH}px (${hasWithDesc ? 'with-desc' : 'compact'}) | pt=${contentPT} bodyPB=${bodyPB}`);
  }

  await browser.close();
  printReport();
}

function printReport() {
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
  console.log('\n' + '═'.repeat(72));
  console.log(`VALIDACIÓN VISUAL — ${ts}`);
  console.log('═'.repeat(72));

  let pass = 0, fail = 0, warn = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status.startsWith('WARN') ? '⚠️ ' : '❌';
    r.status === 'PASS' ? pass++ : r.status.startsWith('WARN') ? warn++ : fail++;

    if (r.key === 'sidebar') {
      console.log(`\n${icon} SIDEBAR   Biomasa=${r.hasBiomasa}  Negociación=${r.hasNeg}  Historial=${r.hasHistorial}  "H/E"=${r.hasHistEquipo}`);
      continue;
    }
    console.log(`\n${icon} ${r.key}`);
    console.log(`   eyebrow:  "${r.eyebrow.text}"${r.eyebrow.wrongSep ? ' ← SEP INCORRECTO' : ''}`);
    if (!r.eyebrow.match) console.log(`   esperado: "${r.eyebrow.expected}"`);
    console.log(`   h1:       "${r.h1}"`);
    console.log(`   layout:   hero=${r.layout.heroH} (${r.layout.heroVariant})  content-pt=${r.layout.contentPadTop}  body-pb=${r.layout.bodyPadBottom}  FAB=${r.layout.fabY}`);
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`RESULTADO: ${pass} ✅ PASS | ${warn} ⚠️  WARN | ${fail} ❌ FAIL`);
  console.log(`Capturas:  validate-screenshots/`);
  console.log('═'.repeat(72) + '\n');

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));

  if (fail > 0) process.exit(1);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
