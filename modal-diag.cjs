// modal-diag.cjs — Validación visual de modales con Playwright
// Ejecutar: node modal-diag.cjs  (o: npm run test:modals)
// Requiere: .env.qa con QA_EMAIL, QA_PASSWORD, QA_TENANT (ver .env.qa.example)
// Requiere: servidor dev activo en QA_BASE_URL (npm run dev)
// Solo abre modales y captura screenshots — NO envía formularios ni modifica datos.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const envQaPath = path.join(__dirname, '.env.qa');
if (fs.existsSync(envQaPath)) {
  fs.readFileSync(envQaPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i < 1) return;
    const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  });
}

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const TENANT = process.env.QA_TENANT;
const OUT = path.join(__dirname, 'validate-screenshots', 'modals');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const log = [];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: 10000 });
  await page.locator('input[type=email]').fill(EMAIL);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 15000 });
  await page.evaluate(db => localStorage.setItem('selected_tenant_db', db), TENANT);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}

async function clickByText(page, sel, opts = {}) {
  const btn = page.locator(sel).first();
  try {
    await btn.waitFor({ state: 'visible', timeout: opts.timeout || 6000 });
    await btn.click();
    await page.waitForTimeout(opts.wait || 1300);
    return true;
  } catch { return false; }
}

// Mide si el modal sobresale del sidebar (recorte). El sidebar ocupa 0..navW.
// OJO: todos los modales de esta app van dentro de un .mx-modal-overlay
// fixed+inset:0 con su propio z-index por encima del sidebar (ver index.css),
// asi que SIEMPRE se ven centrados sobre un fondo oscurecido — comparar solo
// las coordenadas X del modal contra el ancho del sidebar da falsos positivos.
async function measureModal(page) {
  return page.evaluate(() => {
    const navW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-width')) || 240;
    const modal = document.querySelector('.mx-modal');
    const sidebar = document.querySelector('.mx-sidebar');
    if (!modal) return { found: false };
    const overlay = modal.closest('.mx-modal-overlay');
    const overlayIsFullscreenFixed = overlay
      && getComputedStyle(overlay).position === 'fixed'
      && overlay.getBoundingClientRect().width >= window.innerWidth - 1;
    const m = modal.getBoundingClientRect();
    const s = sidebar ? sidebar.getBoundingClientRect() : { right: navW };
    // Si el modal vive en un overlay fixed de pantalla completa, el sidebar
    // queda detras del backdrop oscurecido y nunca esta realmente recortado.
    const clippedBySidebar = !overlayIsFullscreenFixed && m.left < s.right - 1;
    return {
      found: true,
      modalLeft: Math.round(m.left),
      modalRight: Math.round(m.right),
      modalWidth: Math.round(m.width),
      sidebarRight: Math.round(s.right),
      overlayIsFullscreenFixed: Boolean(overlayIsFullscreenFixed),
      clippedBySidebar,
    };
  });
}

async function shot(page, key, label, vp) {
  await page.screenshot({ path: `${OUT}/${key}.png`, fullPage: false });
  const meas = await measureModal(page);
  const onLogin = page.url().includes('/login');
  log.push({ key, label, vp, onLogin, ...meas });
  const status = !meas.found ? 'NO-MODAL' : meas.clippedBySidebar ? 'CLIPPED' : 'OK';
  console.log(`[${status}] ${key} (${vp}) modalLeft=${meas.modalLeft} sidebarRight=${meas.sidebarRight}`);
}

async function captureSet(browser, vp, suffix) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await login(page);

  // Nuevo Trato
  await page.goto(`${BASE}/gestion/tratos`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  if (await clickByText(page, 'button:has-text("Nuevo Trato")')) await shot(page, `trato-${suffix}`, 'Nuevo Trato', suffix);

  // Nueva Empresa (proveedor)
  await page.goto(`${BASE}/gestion/proveedores`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  if (await clickByText(page, 'button:has-text("Nuevo proveedor")')) await shot(page, `empresa-${suffix}`, 'Nueva Empresa', suffix);

  // Crear Programa
  await page.goto(`${BASE}/biomasa/programa`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  if (await clickByText(page, 'button:has-text("Crear Programa")', { wait: 1500 })) await shot(page, `programa-${suffix}`, 'Crear Programa', suffix);

  // Muestreo Pasos 1, 2, 3
  await page.goto(`${BASE}/biomasa/muestreos`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  if (await clickByText(page, 'button.mx-btn-primary:has-text("Muestreo")', { wait: 1500 })) {
    await shot(page, `muestreo1-${suffix}`, 'Muestreo Paso 1', suffix);
    if (await clickByText(page, 'button:has-text("Siguiente")', { wait: 1000 })) {
      await shot(page, `muestreo2-${suffix}`, 'Muestreo Paso 2', suffix);
      if (await clickByText(page, 'button:has-text("Siguiente")', { wait: 1000 })) {
        await shot(page, `muestreo3-${suffix}`, 'Muestreo Paso 3', suffix);
      }
    }
  }

  // Quick Capture (FAB)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  const fab = page.locator('button:has-text("Acción rápida")').last();
  try { await fab.waitFor({ state: 'visible', timeout: 6000 }); await fab.click(); await page.waitForTimeout(1200); } catch {}
  await shot(page, `quickcapture-${suffix}`, 'Quick Capture', suffix);

  await ctx.close();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  console.log('=== 1400x900 ===');
  await captureSet(browser, { width: 1400, height: 900 }, '1400');
  console.log('=== 1024x768 ===');
  await captureSet(browser, { width: 1024, height: 768 }, '1024');
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'modal-report.json'), JSON.stringify(log, null, 2));
  const clipped = log.filter(l => l.clippedBySidebar);
  console.log('\n=== RESUMEN ===');
  console.log(`Total capturas: ${log.length} | Recortadas por sidebar: ${clipped.length}`);
  if (clipped.length) clipped.forEach(l => console.log(`  CLIPPED: ${l.key} (modalLeft=${l.modalLeft} < sidebarRight=${l.sidebarRight})`));
  else console.log('  Ninguna recortada por el sidebar ✅');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
