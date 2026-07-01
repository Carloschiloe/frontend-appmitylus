import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Upload, X } from 'lucide-react';
import { apiClient } from '../../../api/apiClient';
import { downloadXlsx } from '../../../utils/downloadXlsx';

const columns = [
  { key: 'nombre', label: 'Transportista' },
  { key: 'rut', label: 'RUT' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'tarifa.comuna', label: 'Comuna' },
  { key: 'tarifa.tipoCamion', label: 'Tipo camión' },
  { key: 'tarifa.costoFijoPorViaje', label: 'Costo viaje' },
  { key: 'tarifa.costoPorKilo', label: 'Costo/kg' },
];

function getValue(row, key) {
  return key.split('.').reduce((acc, part) => acc?.[part], row) ?? '-';
}

export default function ImportTransportistasModal({ open, onClose, onImported, addToast }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  if (!open) return null;

  const handleTemplate = async () => {
    try {
      await downloadXlsx('/importar/plantilla/transportistas', 'plantilla-transportistas.xlsx');
    } catch (error) {
      addToast({ type: 'error', title: 'Error', message: error.message || 'No se pudo descargar la plantilla.' });
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      addToast({ type: 'warning', title: 'Archivo inválido', message: 'Solo se aceptan archivos .xlsx o .xls.' });
      return;
    }

    const form = new FormData();
    form.append('archivo', file);
    setLoadingPreview(true);
    try {
      const data = await apiClient.post('/importar/transportistas/preview', form);
      setPreview(data);
    } catch (error) {
      addToast({ type: 'error', title: 'Error al leer Excel', message: error.message || 'Revisa el formato del archivo.' });
    } finally {
      setLoadingPreview(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoadingConfirm(true);
    try {
      const result = await apiClient.post('/importar/transportistas/confirmar', { filas: preview.filas });
      addToast({
        type: 'success',
        title: 'Importación completada',
        message: `${result.insertados || 0} transportista(s) procesados correctamente.`,
      });
      onImported?.();
      onClose();
    } catch (error) {
      addToast({ type: 'error', title: 'No se pudo importar', message: error.message || 'Intenta nuevamente.' });
    } finally {
      setLoadingConfirm(false);
    }
  };

  return (
    <div className="mx-modal-overlay">
      <div className="mx-modal fletes-import-modal">
        <div className="mx-modal-header">
          <div>
            <h2>Subir Excel de transportistas</h2>
            <p className="fletes-modal-subtitle">Carga transportistas y reemplaza sus tarifas por RUT.</p>
          </div>
          <button type="button" className="mx-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="mx-modal-body">
          <div className="fletes-import-actions">
            <button type="button" className="mx-btn mx-btn-outline" onClick={handleTemplate}>
              <Download size={16} />
              Descargar plantilla
            </button>
            <button type="button" className="mx-btn mx-btn-primary" onClick={() => fileRef.current?.click()} disabled={loadingPreview}>
              <Upload size={16} />
              {loadingPreview ? 'Procesando...' : 'Seleccionar Excel'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>

          {preview && (
            <>
              <div className="fletes-import-summary">
                <span><strong>{preview.resumen?.total || 0}</strong> filas</span>
                <span className="ok"><strong>{preview.resumen?.ok || 0}</strong> ok</span>
                <span className="warn"><strong>{preview.resumen?.duplicados || 0}</strong> duplicadas</span>
                <span className="error"><strong>{preview.resumen?.errores || 0}</strong> con error</span>
                <span><strong>{preview.resumen?.transportistas || 0}</strong> transportistas</span>
              </div>

              {preview.resumen?.errores > 0 && (
                <div className="fletes-import-warning">
                  <AlertTriangle size={16} />
                  Hay filas con error. Solo se confirmarán las filas válidas.
                </div>
              )}

              <div className="fletes-preview-wrap">
                <table className="fletes-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Estado</th>
                      {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas?.map((row) => (
                      <tr key={row._fila} className={row._ok ? 'ok' : 'error'}>
                        <td>{row._fila}</td>
                        <td>{row._ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</td>
                        {columns.map((column) => <td key={column.key}>{getValue(row, column.key)}</td>)}
                        <td>{row._errores?.join(', ') || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="mx-modal-footer">
          <button type="button" className="mx-btn mx-btn-outline" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="mx-btn mx-btn-primary"
            onClick={handleConfirm}
            disabled={!preview || loadingConfirm || (preview.resumen?.ok || 0) === 0}
          >
            {loadingConfirm ? 'Importando...' : 'Confirmar importación'}
          </button>
        </div>
      </div>
    </div>
  );
}
