import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, CheckCircle2, AlertCircle, RotateCcw, FileSpreadsheet, ArrowRight,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { useToast } from '../../context/ToastContext';
import './importar.css';

const STEP_LABELS = ['Descargar plantilla', 'Validar archivo', 'Confirmar importación'];

function StepBar({ step }) {
  return (
    <div className="importar-steps">
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div className={`importar-step ${i < step ? 'done' : i === step ? 'active' : ''}`}>
            <span className="importar-step-num">
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
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
  const [step, setStep] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef(null);

  const handleDescargar = useCallback(async () => {
    try {
      const response = await fetch('/api/importar/plantilla/contactos', {
        credentials: 'include',
        headers: {
          'x-tenant-db': localStorage.getItem('selected_tenant_db') || '',
        },
      });
      if (!response.ok) throw new Error('Error al descargar la plantilla');
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'plantilla-contactos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo descargar la plantilla', type: 'error' });
    }
  }, [addToast]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      addToast({ title: 'Archivo inválido', message: 'Solo se aceptan archivos .xlsx o .xls', type: 'error' });
      return;
    }
    const fd = new FormData();
    fd.append('archivo', file);
    setLoadingPreview(true);
    try {
      const data = await apiClient.post('/importar/contactos/preview', fd);
      setPreview(data);
      setStep(1);
    } catch (err) {
      addToast({ title: 'Error al leer el archivo', message: err?.message || 'Revisa el formato del Excel', type: 'error' });
    } finally {
      setLoadingPreview(false);
    }
  }, [addToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleConfirmar = useCallback(async () => {
    if (!preview) return;
    const filasOk = preview.filas.filter((f) => f._ok);
    if (filasOk.length === 0) {
      addToast({ title: 'Sin filas válidas', message: 'Corrige los errores antes de importar', type: 'warning' });
      return;
    }
    setLoadingConfirm(true);
    try {
      const data = await apiClient.post('/importar/contactos/confirmar', { filas: filasOk });
      setResultado({ ok: true, insertados: data.insertados });
      setStep(2);
    } catch (err) {
      const insertados = err?.data?.insertados ?? 0;
      setResultado({ ok: false, insertados, message: err?.message || 'Error al importar' });
      setStep(2);
    } finally {
      setLoadingConfirm(false);
    }
  }, [preview, addToast]);

  const reset = useCallback(() => {
    setStep(0);
    setPreview(null);
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="importar-page">
      <StepBar step={step} />

      {/* PASO 0: Descargar plantilla */}
      {step === 0 && (
        <div className="importar-card">
          <h3 className="importar-card-title">
            <FileSpreadsheet size={18} />
            Importar Contactos / Proveedores
          </h3>
          <ul className="importar-instructions">
            <li>Descarga la plantilla Excel con el formato requerido.</li>
            <li>Completa las filas con los datos históricos. El campo <strong>Proveedor</strong> es obligatorio (o bien un Contacto con Teléfono/Email).</li>
            <li>En <strong>Biomasa</strong> puedes ingresar: <code>Con Biomasa</code>, <code>Sin Biomasa</code> o dejar vacío.</li>
            <li>Guarda el archivo y cárgalo en el paso siguiente.</li>
          </ul>
          <button type="button" className="importar-btn-download" onClick={handleDescargar}>
            <Download size={15} />
            Descargar plantilla Excel
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
            <Upload size={32} className="importar-dropzone-icon" />
            <p className="importar-dropzone-text">
              {loadingPreview ? 'Procesando archivo…' : 'Haz clic o arrastra tu archivo Excel aquí'}
            </p>
            <p className="importar-dropzone-hint">Formatos aceptados: .xlsx, .xls · Máx 10 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        </div>
      )}

      {/* PASO 1: Preview / validación */}
      {step === 1 && preview && (
        <div className="importar-card">
          <h3 className="importar-card-title">
            <CheckCircle2 size={18} />
            Vista previa de importación
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
              Las filas con error NO se importarán. Solo se importarán las {preview.resumen.ok} filas válidas.
              Puedes continuar o volver a corregir el archivo.
            </p>
          )}

          <div className="importar-preview-wrap">
            <table className="importar-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Estado</th>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Biomasa</th>
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
                    <td>{f.proveedorNombre || '—'}</td>
                    <td>{f.contactoNombre || '—'}</td>
                    <td>{f.contactoTelefono || '—'}</td>
                    <td>{f.contactoEmail || '—'}</td>
                    <td>{f.biomasa || '—'}</td>
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
              <ArrowRight size={15} />
              {loadingConfirm ? 'Importando…' : `Importar ${preview.resumen.ok} registros`}
            </button>
            <button type="button" className="importar-btn secondary" onClick={reset}>
              <RotateCcw size={14} />
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
              {resultado.ok
                ? <CheckCircle2 size={28} />
                : <AlertCircle size={28} />}
            </div>
            <h3 className="importar-result-title">
              {resultado.ok ? '¡Importación completada!' : 'Importación con errores'}
            </h3>
            <p className="importar-result-sub">
              {resultado.ok
                ? `Se importaron ${resultado.insertados} contacto${resultado.insertados !== 1 ? 's' : ''} exitosamente.`
                : resultado.message || `Se importaron ${resultado.insertados} registros con errores.`}
            </p>
            <div className="importar-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="importar-btn secondary" onClick={reset}>
                <RotateCcw size={14} />
                Nueva importación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
