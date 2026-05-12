/**
 * Generador de Reporte Técnico de Muestreo (Versión HTML compartible)
 * Reutilizado por la vista privada y la vista pública.
 */

export const generarHTMLReporte = (m, options = {}) => {
  if (!m) return '';

  const {
    logoUrl = '',
    empresaNom = 'Mitynex',
    appOrigin = typeof window !== 'undefined' ? window.location.origin : '',
    isPublic = false,
    maestros = { cats: [] }
  } = options;

  const fmtNum = (v, dec = 0) => {
    const n = Number(v);
    return isNaN(n) ? '0' : n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  const clasificaciones = Array.isArray(m.clasificaciones) ? m.clasificaciones : [];
  const evaluacionCriterios = Array.isArray(m.evaluacionCriterios) ? m.evaluacionCriterios : [];
  const primary = clasificaciones[0];

  // Normalización de campos para soportar variaciones legacy o de hidratación
  const rend = Number(m.rendimiento ?? m.rendimientoPct ?? 0);
  const uxkg = Number(m.uxkg ?? m.uXKg ?? 0);
  const total = Number(m.total ?? 0);
  const procesable = Number(m.procesable ?? 0);
  const rechazos = Number(m.rechazos ?? m.rechazo ?? 0);
  const defectos = Number(m.defectos ?? m.defecto ?? 0);

  const pctProc = fmtNum(total > 0 ? (procesable / total) * 100 : 0, 1);
  const pctRech = fmtNum(total > 0 ? (rechazos / total) * 100 : 0, 1);
  const pctDef = fmtNum(total > 0 ? (defectos / total) * 100 : 0, 1);
  const fecha = (m.fecha || new Date().toISOString()).slice(0, 10);

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${empresaNom}" style="height:52px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:900;color:#0f766e;letter-spacing:-0.5px;">${empresaNom}</div>`;

  // --- Análisis de auditoría técnica ---
  const parsearFallo = (razon) => {
    if (!razon) return null;
    const mExcede = razon.match(/^(.+?)\s*\((.+?)\)\s+excede el m[áa]ximo\s*\((.+?)\)$/i);
    const mMenor = razon.match(/^(.+?)\s*\((.+?)\)\s+es menor al m[íi]nimo\s*\((.+?)\)$/i);

    let p, v, t, u;
    if (mExcede) { p = mExcede[1].trim(); v = mExcede[2]; t = 'max'; u = mExcede[3]; }
    else if (mMenor) { p = mMenor[1].trim(); v = mMenor[2]; t = 'min'; u = mMenor[3]; }
    else { return { param: razon.trim(), valor: null, tipo: null, umbral: null }; }

    if (p.toLowerCase() === 'calibre') p = 'U x Kg';
    return { param: p, valor: v, tipo: t, umbral: u };
  };

  const fallosMap = new Map();
  evaluacionCriterios
    .filter(ev => !ev.cumple && ev.razon)
    .forEach(ev => {
      ev.razon.split(', ').forEach(r => {
        const f = parsearFallo(r);
        if (!f) return;
        const key = `${f.param}|${f.tipo}|${f.umbral}`;
        if (!fallosMap.has(key)) fallosMap.set(key, f);
      });
    });
  const fallosUnicos = Array.from(fallosMap.values());
  const cumplidores = evaluacionCriterios.filter(ev => ev.cumple);

  let auditNoClasificaHTML = '';
  if (fallosUnicos.length > 0) {
    const filas = fallosUnicos.map(f => {
      let desc = '';
      if (f.tipo === 'max' && f.valor) desc = `${f.valor} — rango permitido: <strong>${f.umbral}</strong>`;
      else if (f.tipo === 'min' && f.valor) desc = `${f.valor} — rango permitido: <strong>${f.umbral}</strong>`;
      else if (f.valor) desc = `valor actual: ${f.valor}`;
      else desc = f.param;
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid #fee2e2;">
        <div style="min-width:14px;height:14px;border-radius:50%;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0;margin-top:2px;">✗</div>
        <div style="font-size:12px;color:#7f1d1d;line-height:1.5;"><strong>${f.param}</strong> — ${desc}</div>
      </div>`;
    }).join('');
    auditNoClasificaHTML = `<div style="margin-top:10px;"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#991b1b;margin-bottom:6px;">Parámetros fuera de rango</div>${filas}</div>`;
  } else {
    auditNoClasificaHTML = `<div style="margin-top:8px;font-size:12px;color:#7f1d1d;font-style:italic;">No se clasificó por parámetros técnicos detallados.</div>`;
  }

  const auditCumpleHTML = cumplidores.length > 0 ? `
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#166534;margin-bottom:6px;">Criterios aprobados</div>
      ${cumplidores.map(ev => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #dcfce7;">
          <div style="min-width:14px;height:14px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex-shrink:0;">✓</div>
          <div style="font-size:12px;color:#14532d;"><strong>${ev.nombre}</strong> — Todos los parámetros dentro del rango</div>
        </div>`).join('')}
    </div>` : '';

  let auditoriaHTML = '';
  if (primary) {
    auditoriaHTML = `
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px 18px;">
        <div style="font-size:14px;font-weight:800;color:#166534;margin-bottom:4px;">
          ✅ Clasifica como: ${primary.nombre}${primary.tipoPrincipal ? ` <span style="font-weight:600;font-size:12px;color:#15803d;">(${primary.tipoPrincipal})</span>` : ''}
        </div>
        <div style="font-size:12px;color:#16a34a;margin-bottom:12px;">La materia prima cumple los parámetros establecidos en el maestro vigente.</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">R% Carne</div>
            <div style="font-size:18px;font-weight:800;color:#16a34a;">${fmtNum(rend, 2)}%</div>
          </div>
          <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">U × Kg</div>
            <div style="font-size:18px;font-weight:800;color:#16a34a;">${fmtNum(uxkg, 0)}</div>
          </div>
          <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">% Rechazo</div>
            <div style="font-size:18px;font-weight:800;color:#16a34a;">${pctRech}%</div>
          </div>
        </div>
        ${auditCumpleHTML}
      </div>`;
  } else {
    auditoriaHTML = `<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:16px 18px;"><div style="font-size:14px;font-weight:800;color:#991b1b;margin-bottom:6px;">❌ No clasifica en ninguna categoría del maestro vigente</div>${auditNoClasificaHTML}</div>`;
  }



  // --- Fotos ---
  const catMap = {};
  // MAPEO DE EMERGENCIA: Fallback directo para IDs conocidos si el backend falla
  const emergencyMap = {
    '69d717dfd8ed1240f446cec2': 'Procesable',
    '69d717dfd8ed1240f446cec3': 'Cholga',
    '69d717dfd8ed1240f446cec4': 'Quebrado',
    '69d717dfd8ed1240f446cec5': 'Malton',
    '69d717dfd8ed1240f446cec6': 'Semilla (< 4,5 cm)',
    '69d717dfd8ed1240f446cec7': 'Picoroco y/o colpa',
    '69d717dfd8ed1240f446cec8': 'Basura',
    '69d717dfd8ed1240f446cec9': 'Esponja Severa',
    '69d717dfd8ed1240f446ceca': 'Anemonas',
    '69d717dfd8ed1240f446cecb': 'Valvas Vacias',
    '69d717dfd8ed1240f446cecc': 'U muertas',
    '69d717dfd8ed1240f446cecd': 'Barbilla',
    '69d717dfd8ed1240f446cece': 'Cogotina',
    '69d717dfd8ed1240f446cecf': 'Trizados',
    '69d717dfd8ed1240f446ced0': 'Esponja Leve',
    '69d717dfd8ed1240f446ced1': 'Sarro'
  };
  (maestros?.cats || []).forEach(c => { catMap[String(c._id)] = c.nombre; });

  const allPhotos = [];
  if (m.catDetails) {
    Object.entries(m.catDetails).forEach(([catId, data]) => {
      if (!data?.photos) return;
      // Prioridad: 1. data.nombre (backend), 2. maestros (frontend), 3. emergencyMap (hardcoded), 4. fallback 'Ítem'
      const nombreCat = (data.nombre && data.nombre !== 'Ítem')
        ? data.nombre
        : (catMap[catId] || emergencyMap[catId] || 'Ítem');
      const pesoItem = Number(m.cats?.[catId]) || 0;
      const pctItem = total > 0 && pesoItem > 0 ? `${fmtNum((pesoItem / total) * 100, 1)}%` : null;
      const label = pctItem ? `${nombreCat} — ${pctItem}` : nombreCat;
      const photos = Array.isArray(data.photos) ? data.photos : [];
      photos.forEach(p => {
        const url = p.url || p.signedUrl;
        if (url && url !== logoUrl) allPhotos.push({ url, label });
      });
    });
  }
  if (Array.isArray(m.generalPhotos)) {
    m.generalPhotos.forEach(p => {
      const url = p.url || p.signedUrl;
      if (url && url !== logoUrl) allPhotos.push({ url, label: 'Evidencia general' });
    });
  }

  const photosHTML = allPhotos.length > 0 ? `
    <div class="section">
      <div class="sec-title">Evidencias Fotográficas</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:10px;">
        ${allPhotos.map(p => `
          <div style="text-align:center;">
            <img src="${p.url}" class="img-zoomable" alt="Evidencia" onclick="openLightbox(this.src)" style="width:100%;height:130px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />
            <div style="font-size:11px;font-weight:600;color:#475569;margin-top:5px;">${p.label}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  const pdfFilename = `reporte-muestreo-${(m.proveedorNombre || 'reporte').replace(/[^a-z0-9]/gi, '-')}.pdf`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Muestreo — ${m.proveedorNombre || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;padding:32px;font-size:14px;line-height:1.5}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #0f766e;margin-bottom:24px;}
  .header-title{font-size:20px;font-weight:800;color:#0f172a;}
  .header-sub{font-size:12px;color:#64748b;margin-top:2px;}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:22px;}
  .meta-item label{font-size:10px;font-weight:700;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:2px;}
  .meta-item span{font-size:13px;font-weight:700;color:#0f172a;}
  .section{margin-bottom:22px}
  .sec-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:.06em;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:4px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-label{font-size:10px;color:#64748b;margin-bottom:4px}
  .kpi-val{font-size:20px;font-weight:800;color:#0f766e}
  .clas-box{border:2px solid #16a34a;border-radius:10px;padding:16px;text-align:center;background:#f0fdf4}
  .clas-box.fail{border-color:#ef4444;background:#fef2f2}
  .clas-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#475569}
  .clas-val{font-size:26px;font-weight:800;color:#16a34a;margin-top:4px}
  .clas-val.fail{color:#ef4444}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:10px;}
  .no-print{display:flex}
  
  /* Lightbox Styles */
  .img-zoomable { cursor: zoom-in; transition: transform 0.2s; }
  .img-zoomable:hover { transform: scale(1.02); }
  #lightbox {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; z-index: 9999;
    padding: 40px; cursor: zoom-out;
  }
  #lightbox img { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
  #lightbox .close-btn {
    position: absolute; top: 20px; right: 20px; color: white; font-size: 30px;
    font-weight: bold; cursor: pointer; background: rgba(255,255,255,0.1);
    width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
  }

  @media print{body{padding:16px}.no-print{display:none!important} #lightbox{display:none!important}}
</style>
</head>
<body>
  ${!isPublic ? `
  <div class="no-print" style="background:#0f766e;color:#fff;padding:10px 14px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
    <span style="font-weight:700;font-size:13px;">Informe Técnico &mdash; Vista Previa</span>
    <button onclick="window.print()" style="background:#fff;color:#0f766e;border:none;padding:6px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;">🖨️ Imprimir / PDF</button>
  </div>` : ''}

  <div class="header">
    <div>${logoBlock}</div>
    <div style="text-align:right;">
      <div class="header-title">Informe de Muestreo MMPP</div>
      <div class="header-sub">${empresaNom} · ${isPublic ? 'Consulta Pública' : 'Auditoría Interna'}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Proveedor</label><span>${m.proveedorNombre || '—'}</span></div>
    <div class="meta-item"><label>Centro</label><span>${m.centroCodigo || '—'}</span></div>
    <div class="meta-item"><label>Línea</label><span>${m.linea || '—'}</span></div>
    <div class="meta-item"><label>Fecha</label><span>${fecha}</span></div>
    <div class="meta-item"><label>Responsable</label><span>${m.responsable || '—'}</span></div>
    <div class="meta-item"><label>Origen</label><span>${m.origen || '—'}</span></div>
  </div>

  <div class="section">
    <div class="sec-title">Indicadores Técnicos de la Materia Prima</div>
    <div class="kpis" style="grid-template-columns: repeat(2, 1fr);">
      <div class="kpi" style="background:#f0f9ff; border-color:#bae6fd;">
        <div class="kpi-label" style="color:#0369a1;">Rendimiento (R% Carne)</div>
        <div class="kpi-val" style="color:#0369a1;">${fmtNum(rend, 2)}%</div>
      </div>
      <div class="kpi" style="background:#f0fdf4; border-color:#bbf7d0;">
        <div class="kpi-label" style="color:#15803d;">U × Kg (Calibre)</div>
        <div class="kpi-val" style="color:#15803d;">${fmtNum(uxkg, 0)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Clasificación</div>
    <div class="clas-box ${primary ? '' : 'fail'}">
      <div class="clas-label">Tipo de producto</div>
      <div class="clas-val ${primary ? '' : 'fail'}">${primary ? primary.nombre : 'No Clasifica'}</div>
      ${primary?.tipoPrincipal ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">${primary.tipoPrincipal}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Resultado de la Auditoría Técnica</div>
    ${auditoriaHTML}
  </div>

  <!-- Desglose de Calidad Detallado -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px;">
    <!-- Columna Procesables -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #bbf7d0;padding-bottom:4px;">
        <div style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;">Detalle Procesables</div>
        <div style="font-size:12px;font-weight:800;color:#166534;">${pctProc}%</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        ${(() => {
          const totalPeso = Number(m.total) || 1;
          const items = Object.entries(m.catDetails || {}).filter(([cid, d]) => {
            const t = String(d?.tipo || d?.tipoCat || '').toLowerCase();
            const val = Number(d?.valor || (m.cats instanceof Map ? m.cats.get(cid) : m.cats?.[cid]) || 0);
            return t === 'procesable' && val > 0;
          });
          return items.map(([cid, d]) => {
            const porc = d?.porcentaje || d?.porc || ((Number(d?.valor || m.cats?.[cid] || 0) / totalPeso) * 100);
            return `<tr><td style="padding:3px 0;color:#1e293b;">${d?.nombre || 'Procesable'}</td><td style="padding:3px 0;text-align:right;font-weight:700;color:#166534;">${fmtNum(porc, 1)}%</td></tr>`;
          }).join('') || '<tr><td colspan="2" style="font-style:italic;color:#94a3b8;font-size:11px;">Sin datos</td></tr>';
        })()}
      </table>
    </div>

    <!-- Columna Rechazos -->
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #fecaca;padding-bottom:4px;">
        <div style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;">Detalle Rechazos</div>
        <div style="font-size:12px;font-weight:800;color:#991b1b;">${pctRech}%</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        ${(() => {
          const totalPeso = Number(m.total) || 1;
          const items = Object.entries(m.catDetails || {}).filter(([cid, d]) => {
            const t = String(d?.tipo || d?.tipoCat || '').toLowerCase();
            const val = Number(d?.valor || (m.cats instanceof Map ? m.cats.get(cid) : m.cats?.[cid]) || 0);
            return t === 'rechazo' && val > 0;
          });
          return items.map(([cid, d]) => {
            const porc = d?.porcentaje || d?.porc || ((Number(d?.valor || m.cats?.[cid] || 0) / totalPeso) * 100);
            return `<tr><td style="padding:3px 0;color:#1e293b;">${d?.nombre || 'Rechazo'}</td><td style="padding:3px 0;text-align:right;font-weight:700;color:#991b1b;">${fmtNum(porc, 1)}%</td></tr>`;
          }).join('') || '<tr><td colspan="2" style="font-style:italic;color:#94a3b8;font-size:11px;">Sin datos</td></tr>';
        })()}
      </table>
    </div>

    <!-- Columna Defectos -->
    <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:10px;padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #fef3c7;padding-bottom:4px;">
        <div style="font-size:10px;font-weight:800;color:#92400e;text-transform:uppercase;">Detalle Defectos</div>
        <div style="font-size:12px;font-weight:800;color:#92400e;">${pctDef}%</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        ${(() => {
          const totalPeso = Number(m.total) || 1;
          const items = Object.entries(m.catDetails || {}).filter(([cid, d]) => {
            const t = String(d?.tipo || d?.tipoCat || '').toLowerCase();
            const val = Number(d?.valor || (m.cats instanceof Map ? m.cats.get(cid) : m.cats?.[cid]) || 0);
            return t === 'defecto' && val > 0;
          });
          return items.map(([cid, d]) => {
            const porc = d?.porcentaje || d?.porc || ((Number(d?.valor || m.cats?.[cid] || 0) / totalPeso) * 100);
            return `<tr><td style="padding:3px 0;color:#1e293b;">${d?.nombre || 'Defecto'}</td><td style="padding:3px 0;text-align:right;font-weight:700;color:#92400e;">${fmtNum(porc, 1)}%</td></tr>`;
          }).join('') || '<tr><td colspan="2" style="font-style:italic;color:#94a3b8;font-size:11px;">Sin datos</td></tr>';
        })()}
      </table>
    </div>
  </div>

  ${photosHTML}

  <div class="footer">
    <span>${empresaNom}</span>
    <span>Sistema MMPP · ${new Date().toLocaleDateString('es-CL')}</span>
  </div>

  <div id="lightbox" onclick="this.style.display='none'">
    <div class="close-btn">&times;</div>
    <img id="lightbox-img" src="" alt="Zoom" />
  </div>

  <script>
    function openLightbox(src) {
      const lb = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      img.src = src;
      lb.style.display = 'flex';
    }
    // Cerrar con escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.getElementById('lightbox').style.display = 'none';
    });
  </script>
</body>
</html>`;
};
