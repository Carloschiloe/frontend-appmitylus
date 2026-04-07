import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(THIS_FILE), '..');
const REPORTS_DIR = path.join(ROOT, 'scripts', 'reports');
const SHOTS_DIR = path.join(REPORTS_DIR, 'qa-contactos-shots');
const REPORT_PATH = path.join(REPORTS_DIR, 'qa-contactos-visual.json');
const DEV_SCRIPT = path.join(ROOT, 'scripts', 'dev-vite.ps1');
const BASE_URL = 'http://localhost:5173';

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 404) return true;
    } catch {}
    await sleep(350);
  }
  return false;
}

function startDevServer() {
  const ps = spawn(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', DEV_SCRIPT, '-Port', '5173'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const logs = [];
  ps.stdout.on('data', (buf) => {
    logs.push(String(buf));
  });
  ps.stderr.on('data', (buf) => {
    logs.push(String(buf));
  });

  return { ps, logs };
}

function stopLingeringProjectVite() {
  const escapedRoot = ROOT.replace(/'/g, "''");
  const cmd = `
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -match '^node(\\.exe)?$' -and
        $_.CommandLine -match 'vite(\\.js)?' -and
        $_.CommandLine -match '${escapedRoot}'
      } |
      ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
      }
  `;
  spawnSync('powershell', ['-NoProfile', '-Command', cmd], { cwd: ROOT, stdio: 'ignore' });
}

async function activateTab(page, hash) {
  await page.evaluate((h) => {
    const link = document.querySelector(`.tabs a[href="${h}"]`);
    if (link) {
      link.click();
      return;
    }
    const jump = document.querySelector(`[data-open-consulta-panel="${h}"]`);
    if (jump) jump.click();
    location.hash = h;
  }, hash);
  await page.waitForTimeout(450);
}

async function injectLongRows(page) {
  await page.evaluate(() => {
    const LONG = 'PROVEEDOR_SUPER_LARGO_SIN_ESPACIOS_'.repeat(8);
    const LONG2 = 'Contacto Con Nombre Muy Largo '.repeat(6);

    const ensureRow = (tableId, cols) => {
      const tbody = document.querySelector(`#${tableId} tbody`);
      if (!tbody) return;
      if (!tbody.querySelector('tr')) {
        const tds = Array.from({ length: cols }, (_, i) => `<td data-col="${i}">-</td>`).join('');
        tbody.innerHTML = `<tr>${tds}</tr>`;
      }
      const first = tbody.querySelector('tr');
      if (!first) return;
      const cells = first.querySelectorAll('td');
      cells.forEach((c, idx) => {
        if (idx === cells.length - 1) {
          c.innerHTML = `
            <div class="tbl-actions">
              <button type="button" class="tbl-action-btn"><i class="material-icons">visibility</i></button>
              <button type="button" class="tbl-action-btn"><i class="material-icons">edit</i></button>
              <button type="button" class="tbl-action-btn"><i class="material-icons">delete</i></button>
            </div>
          `;
        } else if (idx === 1 || idx === 2 || idx === 3) {
          c.textContent = idx % 2 ? LONG : LONG2;
        } else {
          c.textContent = LONG.slice(0, 80);
        }
      });
    };

    ensureRow('tablaContactos', 7);
    ensureRow('tablaVisitas', 8);
    ensureRow('tablaPersonas', 6);
    ensureRow('tablaMuestreos', 8);
  });
}

async function collectTabMetrics(page, tabHash, label) {
  await activateTab(page, tabHash);
  if (tabHash === '#tab-interacciones') {
    await page.waitForTimeout(900);
  }

  const metric = await page.evaluate((hash) => {
    const doc = document.documentElement;
    const body = document.body;
    const panel = document.querySelector(hash);
    const card = panel?.querySelector('.mmpp-card') || panel;

    const pageOverflow = Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
    const cardOverflow = card ? (card.scrollWidth - card.clientWidth) : 0;
    const toolbarOverflow = Array.from(
      panel?.querySelectorAll('.table-toolbar, .visitas-toolbar, .interacciones-toolbar, .int-modern-filters, #muFiltrosBar') || []
    ).map((el) => ({
      cls: el.className,
      overflow: el.scrollWidth - el.clientWidth
    }));

    const actionGroups = Array.from(panel?.querySelectorAll('.tbl-actions') || []);
    const clippedActions = actionGroups.filter((g) => {
      const gr = g.getBoundingClientRect();
      return Array.from(g.children).some((btn) => {
        const r = btn.getBoundingClientRect();
        return r.left < gr.left - 0.5 || r.right > gr.right + 0.5;
      });
    }).length;

    return {
      pageOverflow,
      cardOverflow,
      toolbarOverflow,
      actionGroups: actionGroups.length,
      clippedActions
    };
  }, tabHash);

  return {
    tab: label,
    hash: tabHash,
    ...metric
  };
}

async function runViewport(browser, viewport, deviceName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const url = `${BASE_URL}/html/Abastecimiento/contactos/contactos.html#tab-consulta`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);

  await injectLongRows(page);

  const tabs = [
    { hash: '#tab-contactos', label: 'Proveedores' },
    { hash: '#tab-personas', label: 'Agenda' },
    { hash: '#tab-interacciones', label: 'Interacciones remotas' },
    { hash: '#tab-muestreos', label: 'Muestreos' }
  ];

  const out = [];
  for (const t of tabs) {
    const metric = await collectTabMetrics(page, t.hash, t.label);
    out.push(metric);
    const shotName = `${deviceName}-${t.hash.replace('#tab-', '')}.png`;
    await page.screenshot({ path: path.join(SHOTS_DIR, shotName), fullPage: true });
  }

  await context.close();
  return out;
}

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (err) {
    console.error('[qa-contactos-visual] playwright no disponible.', err?.message || err);
    process.exit(1);
  }

  const { ps, logs } = startDevServer();
  let killed = false;
  const stopServer = () => {
    if (killed) return;
    killed = true;
    try {
      if (ps.pid) {
        spawnSync('taskkill', ['/PID', String(ps.pid), '/T', '/F'], { cwd: ROOT, stdio: 'ignore' });
      }
    } catch {}
    try { ps.kill('SIGTERM'); } catch {}
    try { ps.kill('SIGKILL'); } catch {}
    stopLingeringProjectVite();
  };
  process.on('exit', stopServer);
  process.on('SIGINT', () => { stopServer(); process.exit(130); });
  process.on('SIGTERM', () => { stopServer(); process.exit(143); });

  const ok = await waitForServer(`${BASE_URL}/html/Abastecimiento/contactos/contactos.html`, 35000);
  if (!ok) {
    stopServer();
    const joined = logs.join('');
    console.error('[qa-contactos-visual] no levantó servidor en tiempo.');
    console.error(joined.slice(-2500));
    process.exit(1);
  }

  let browser;
  try {
    try {
      browser = await playwright.chromium.launch({ channel: 'msedge', headless: true });
    } catch {
      browser = await playwright.chromium.launch({ headless: true });
    }

    const desktop = await runViewport(browser, { width: 1440, height: 900 }, 'desktop');
    const mobile = await runViewport(browser, { width: 390, height: 844 }, 'mobile');

    const report = {
      createdAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      screenshotsDir: SHOTS_DIR,
      results: { desktop, mobile }
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const worst = [...desktop, ...mobile].map((m) => ({
      tab: `${m.tab} (${m.hash})`,
      pageOverflow: Number(m.pageOverflow || 0),
      cardOverflow: Number(m.cardOverflow || 0),
      clippedActions: Number(m.clippedActions || 0)
    }));

    console.log(JSON.stringify({ ok: true, reportPath: REPORT_PATH, summary: worst }, null, 2));
  } finally {
    try { await browser?.close(); } catch {}
    stopServer();
  }
}

run().catch((err) => {
  console.error('[qa-contactos-visual] error:', err?.stack || err?.message || err);
  process.exit(1);
});
