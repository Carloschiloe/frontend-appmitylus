import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, CheckCircle2, AlertCircle, RotateCcw,
  Building2, Users, ArrowRight,
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
      { key: 'centroHectareas',      label: 'Hás' },
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

export default function ImportarDatos() {
  const { addToast } = useToast();
  const [step, setStep]             = useState(0);
  const [tipo, setTipo]             = useState(null);   // 'proveedores' | 'contactos'
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [preview, setPreview]       = useState(null);
  const [resultado, setResultado]   = useState(null);
  const [dragover, setDragover]     = useState(false);
  const fileInputRef = useRef(null);

  const config = tipo ? TIPOS[tipo] : null;

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
    const filasOk = preview.filas.filter((f) => f._ok);
    if (filasOk.length === 0) {
      addToast({ title: 'Sin filas válidas', message: 'Corrige los errores antes de importar', type: 'warning' });
      return;
    }
    setLoadingConfirm(true);
    try {
      const data = await apiClient.post(config.confirmarEndpoint, { filas: filasOk });
      setResultado({ ok: true, insertados: data.insertados });
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
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSelectTipo = (t) => {
    setTipo(t);
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
                  onClick={() => handleSelectTipo(key)}
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
            <span className="importar-resumen-badge ok">{preview.resumen.ok} listas</span>
            {preview.resumen.errores > 0 && (
              <span className="importar-resumen-badge error">{preview.resumen.errores} con error</span>
            )}
          </div>

          {preview.resumen.errores > 0 && (
            <p className="importar-instructions" style={{ color: '#b91c1c' }}>
              Las filas con error no se importarán. Solo se insertan las {preview.resumen.ok} filas válidas.
            </p>
          )}

          <div className="importar-preview-wrap">
            <table className="importar-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Estado</th>
                  {config.columnas.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>Errores</th>
                </tr>
              </thead>
              <tbody>
                {preview.filas.map((f) => (
                  <tr key={f._fila} className={f._ok ? 'row-ok' : 'row-error'}>
                    <td>{f._fila}</td>
                    <td>
                      <span className={`importar-row-status ${f._ok ? 'ok' : 'error'}`}>
                        {f._ok ? 'OK' : 'Error'}
                      </span>
                    </td>
                    {config.columnas.map((c) => (
                      <td key={c.key}>{f[c.key] ?? '—'}</td>
                    ))}
                    <td style={{ color: '#b91c1c', fontSize: 11 }}>
                      {f._errores?.join(', ') || ''}
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
              {loadingConfirm ? 'Importando…' : `Importar ${preview.resumen.ok} registros`}
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
                ? `Se importaron ${resultado.insertados} ${config?.label?.toLowerCase() ?? 'registro'}${resultado.insertados !== 1 ? 's' : ''} exitosamente.`
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
