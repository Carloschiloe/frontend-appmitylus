import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, CheckCircle2, AlertCircle, RotateCcw,
  Building2, Users, FlaskConical, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import './importar.css';

const TIPOS = {
  proveedores: {
    label: 'Proveedores',
    sublabel: 'Empresas con sus datos de biomasa, centro y responsable',
    icon: Building2,
    plantillaUrl: '/api/importar/plantilla/proveedores',
    plantillaFile: 'plantilla-proveedores.xlsx',
    previewEndpoint: '/importar/proveedores/preview',
    confirmarEndpoint: '/importar/proveedores/confirmar',
    columnas: [
      { key: 'proveedorNombre',      label: 'Empresa' },
      { key: 'biomasa',              label: 'Biomasa' },
      { key: 'localidad',            label: 'Localidad' },
      { key: 'responsablePG',        label: 'Responsable' },
      { key: 'centroComuna',         label: 'Comuna' },
      { key: 'tonsDisponiblesAprox', label: 'Tons' },
    ],
    instrucciones: [
      <>El campo <strong>Nombre empresa</strong> es obligatorio.</>,
      <>En <strong>Biomasa</strong> ingresa: <code>Con Biomasa</code>, <code>Sin Biomasa</code> o deja vacío.</>,
      'Los demás campos son opcionales.',
    ],
  },
  contactos: {
    label: 'Contactos',
    sublabel: 'Personas de contacto dentro de una empresa',
    icon: Users,
    plantillaUrl: '/api/importar/plantilla/contactos',
    plantillaFile: 'plantilla-contactos.xlsx',
    previewEndpoint: '/importar/contactos/preview',
    confirmarEndpoint: '/importar/contactos/confirmar',
    columnas: [
      { key: 'contactoNombre',   label: 'Contacto' },
      { key: 'contactoTelefono', label: 'Teléfono' },
      { key: 'contactoEmail',    label: 'Email' },
      { key: 'proveedorNombre',  label: 'Empresa asociada' },
    ],
    instrucciones: [
      <>El campo <strong>Nombre contacto</strong> es obligatorio.</>,
      <>Debe tener al menos <strong>Teléfono</strong> o <strong>Email</strong>.</>,
      <><strong>Empresa asociada</strong> es opcional — vincula el contacto a un proveedor existente.</>,
    ],
  },
  muestreos: {
    label: 'Muestreos',
    sublabel: 'Resultados históricos de muestreos por proveedor',
    icon: FlaskConical,
    plantillaUrl: '/api/importar/plantilla/muestreos',
    plantillaFile: 'plantilla-muestreos.xlsx',
    previewEndpoint: '/importar/muestreos/preview',
    confirmarEndpoint: '/importar/muestreos/confirmar',
    // columnas base; se agregan dinámicamente las categorías del tenant
    columnas: [
      { key: '_fechaDisplay',  label: 'Fecha' },
      { key: 'proveedorNombre', label: 'Proveedor' },
      { key: 'centroCodigo',   label: 'Centro' },
      { key: 'uxkg',           label: 'Calibre' },
      { key: 'pesoVivo',       label: 'Peso Vivo' },
      { key: 'rendimiento',    label: 'Rend %' },
    ],
    instrucciones: [
      <>Los campos <strong>Fecha</strong> y <strong>Proveedor</strong> son obligatorios.</>,
      <>La fecha debe estar en formato <code>YYYY-MM-DD</code> (ej: 2024-03-15) o <code>DD-MM-YYYY</code>.</>,
      'La plantilla incluye automáticamente las categorías configuradas en Maestros.',
    ],
  },
};

const STEP_LABELS = ['Seleccionar tipo', 'Validar archivo', 'Confirmar'];

function StepBar({ step }) {
  return (
    <div className="importar-steps">
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div className={`importar-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            <span className="importar-step-num">
              {i < step ? <CheckCircle2 size={13} /> : i + 1}
            </span>
            <span className="importar-step-label">{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`importar-step-line ${i < step ? 'done' : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function RowStatus({ fila }) {
  if (!fila._ok) {
    return <span className="importar-row-status error">Error</span>;
  }
  if (fila._duplicado) {
    return <span className="importar-row-status duplicado">Duplicado</span>;
  }
  return <span className="importar-row-status ok">OK</span>;
}

export default function ImportarDatos() {
  const { addToast }  = useToast();
  const [step, setStep]                     = useState(0);
  const [tipo, setTipo]                     = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [preview, setPreview]               = useState(null);
  const [previewCats, setPreviewCats]       = useState([]);  // categorías dinámicas para muestreos
  const [resultado, setResultado]           = useState(null);
  const [dragover, setDragover]             = useState(false);
  const fileInputRef = useRef(null);

  const config = tipo ? TIPOS[tipo] : null;

  // Columnas de la tabla preview: base + dinámicas (muestreos)
  const tableColumnas = config
    ? [
        ...config.columnas,
        ...(tipo === 'muestreos'
          ? previewCats.map((c) => ({ key: `__cat__${c._id}`, label: c.nombre, _catNombre: c.nombre }))
          : []),
      ]
    : [];

  const handleDescargar = useCallback(async () => {
    if (!config) return;
    try {
      const response = await fetch(config.plantillaUrl, {
        credentials: 'include',
        headers: { 'x-tenant-db': localStorage.getItem('selected_tenant_db') || '' },
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = config.plantillaFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo descargar la plantilla', type: 'error' });
    }
  }, [config, addToast]);

  const handleFile = useCallback(async (file) => {
    if (!file || !config) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      addToast({ title: 'Archivo inválido', message: 'Solo se aceptan .xlsx o .xls', type: 'error' });
      return;
    }
    const fd = new FormData();
    fd.append('archivo', file);
    setLoadingPreview(true);
    try {
      const data = await apiClient.post(config.previewEndpoint, fd);
      setPreview(data);
      setPreviewCats(data.categorias || []);
      setStep(1);
    } catch (err) {
      addToast({ title: 'Error al leer el archivo', message: err?.message || 'Revisa el formato del Excel', type: 'error' });
    } finally {
      setLoadingPreview(false);
    }
  }, [config, addToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleConfirmar = useCallback(async () => {
    if (!preview || !config) return;
    // Backend filtra _duplicado y _ok internamente, enviamos todas
    if (preview.resumen.ok === 0) {
      addToast({ title: 'Sin filas nuevas', message: 'No hay registros para importar', type: 'warning' });
      return;
    }
    setLoadingConfirm(true);
    try {
      const data = await apiClient.post(config.confirmarEndpoint, { filas: preview.filas });
      setResultado({ ok: true, insertados: data.insertados, omitidos: preview.resumen.duplicados ?? 0 });
      setStep(2);
    } catch (err) {
      setResultado({ ok: false, insertados: err?.data?.insertados ?? 0, message: err?.message });
      setStep(2);
    } finally {
      setLoadingConfirm(false);
    }
  }, [preview, config, addToast]);

  const reset = useCallback(() => {
    setStep(0);
    setTipo(null);
    setPreview(null);
    setPreviewCats([]);
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const getCellValue = (fila, col) => {
    if (col._catNombre !== undefined) {
      const v = fila._cats_display?.[col._catNombre];
      return v != null ? v : '—';
    }
    const v = fila[col.key];
    return v != null && v !== '' ? v : '—';
  };

  return (
    <div className="importar-page">
      <StepBar step={step} />

      {/* PASO 0: Seleccionar tipo */}
      {step === 0 && (
        <div className="importar-card">
          <h3 className="importar-card-title">¿Qué quieres importar?</h3>

          <div className="importar-tipo-selector">
            {Object.entries(TIPOS).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  type="button"
                  className={`importar-tipo-btn ${tipo === key ? 'selected' : ''}`}
                  onClick={() => setTipo(key)}
                >
                  <Icon size={24} />
                  <span className="importar-tipo-label">{cfg.label}</span>
                  <span className="importar-tipo-sub">{cfg.sublabel}</span>
                </button>
              );
            })}
          </div>

          {config && (
            <>
              <div className="importar-divider" />
              <ul className="importar-instructions">
                {config.instrucciones.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
              <button type="button" className="importar-btn-download" onClick={handleDescargar}>
                <Download size={14} />
                Descargar plantilla — {config.label}
              </button>

              <div
                className={`importar-dropzone ${dragover ? 'dragover' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <Upload size={30} className="importar-dropzone-icon" />
                <p className="importar-dropzone-text">
                  {loadingPreview ? 'Procesando…' : 'Haz clic o arrastra tu archivo Excel aquí'}
                </p>
                <p className="importar-dropzone-hint">.xlsx / .xls · máx 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* PASO 1: Preview */}
      {step === 1 && preview && config && (
        <div className="importar-card">
          <h3 className="importar-card-title">
            <CheckCircle2 size={17} />
            Vista previa — {config.label}
          </h3>

          <div className="importar-resumen">
            <span className="importar-resumen-badge total">{preview.resumen.total} filas</span>
            <span className="importar-resumen-badge ok">{preview.resumen.ok} nuevas</span>
            {preview.resumen.duplicados > 0 && (
              <span className="importar-resumen-badge duplicado">{preview.resumen.duplicados} duplicadas</span>
            )}
            {preview.resumen.errores > 0 && (
              <span className="importar-resumen-badge error">{preview.resumen.errores} con error</span>
            )}
          </div>

          {preview.resumen.duplicados > 0 && (
            <p className="importar-instructions" style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} />
              {preview.resumen.duplicados} fila{preview.resumen.duplicados !== 1 ? 's' : ''} ya existen en la base de datos y serán omitidas.
            </p>
          )}

          <div className="importar-preview-wrap">
            <table className="importar-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Estado</th>
                  {tableColumnas.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {preview.filas.map((f) => (
                  <tr key={f._fila} className={!f._ok ? 'row-error' : f._duplicado ? 'row-duplicado' : 'row-ok'}>
                    <td>{f._fila}</td>
                    <td><RowStatus fila={f} /></td>
                    {tableColumnas.map((c) => (
                      <td key={c.key}>{getCellValue(f, c)}</td>
                    ))}
                    <td style={{ fontSize: 11, color: !f._ok ? '#b91c1c' : f._duplicado ? '#92400e' : undefined }}>
                      {!f._ok ? f._errores?.join(', ') : f._duplicado ? 'Ya existe' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="importar-actions">
            <button
              type="button"
              className="importar-btn primary"
              onClick={handleConfirmar}
              disabled={loadingConfirm || preview.resumen.ok === 0}
            >
              <ArrowRight size={14} />
              {loadingConfirm
                ? 'Importando…'
                : `Importar ${preview.resumen.ok} registro${preview.resumen.ok !== 1 ? 's' : ''}${preview.resumen.duplicados > 0 ? ` (${preview.resumen.duplicados} omitidos)` : ''}`}
            </button>
            <button type="button" className="importar-btn secondary" onClick={reset}>
              <RotateCcw size={13} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Resultado */}
      {step === 2 && resultado && (
        <div className="importar-card">
          <div className="importar-result">
            <div className={`importar-result-icon ${resultado.ok ? 'success' : 'error'}`}>
              {resultado.ok ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <h3 className="importar-result-title">
              {resultado.ok ? '¡Importación completada!' : 'Importación con errores'}
            </h3>
            <p className="importar-result-sub">
              {resultado.ok
                ? `Se importaron ${resultado.insertados} ${config?.label?.toLowerCase() ?? 'registro'}${resultado.insertados !== 1 ? 's' : ''} exitosamente.${resultado.omitidos > 0 ? ` ${resultado.omitidos} duplicados omitidos.` : ''}`
                : resultado.message || `Se insertaron ${resultado.insertados} registros con errores.`}
            </p>
            <div className="importar-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="importar-btn secondary" onClick={reset}>
                <RotateCcw size={13} />
                Nueva importación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
