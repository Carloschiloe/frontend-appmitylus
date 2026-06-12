import { useCallback, useEffect } from 'react';
import { createPublicMuestreoShare, getMuestreoReportHtml } from './muestreos.api';

function buildShareText({ muestreo, url }) {
  const proveedor = muestreo.proveedorNombre || 'Proveedor';
  const centro = muestreo.centroCodigo || muestreo.centroNombre || 'Sin Centro';
  const fecha = muestreo.fecha ? new Date(muestreo.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  return {
    proveedor,
    message:
      `Informe de muestreo Mitynex\n\n` +
      `Proveedor: ${proveedor}\n` +
      `Centro: ${centro}\n` +
      `Fecha: ${fecha}\n\n` +
      `Ver informe:\n${url}`,
  };
}

export default function useMuestreoReport({
  addToast,
  setIsLoadingDetails,
  setShareData,
  setIsShareModalOpen,
}) {
  const verReporte = useCallback(async (muestreo) => {
    const id = muestreo._id || muestreo.id;
    if (!id) return;

    try {
      setIsLoadingDetails(true);
      // El HTML lo genera el backend con la misma plantilla del reporte publico
      const html = await getMuestreoReportHtml(id);
      if (!html) return;

      const win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) {
        addToast({ title: 'Bloqueo Detectado', message: 'Habilita ventanas emergentes para generar el informe', type: 'warning' });
        return;
      }

      win.document.write(html);
      win.document.close();
    } catch {
      addToast({ title: 'Error', message: 'No se pudo cargar el detalle del reporte.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [addToast, setIsLoadingDetails]);

  const compartirReporte = useCallback(async (muestreo) => {
    const id = muestreo._id || muestreo.id;
    if (!id) return;

    try {
      setIsLoadingDetails(true);
      const res = await createPublicMuestreoShare(id);
      const publicUrl = res.shortUrl || res.url;
      const shareText = buildShareText({ muestreo, url: publicUrl });

      setShareData({
        url: publicUrl,
        message: shareText.message,
        proveedor: shareText.proveedor,
      });
      setIsShareModalOpen(true);
    } catch {
      addToast({ title: 'Error', message: 'No se pudo generar el enlace para compartir.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [addToast, setIsLoadingDetails, setIsShareModalOpen, setShareData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reporteId = params.get('reporteId');
    const tenantUrl = params.get('tenant');

    if (!reporteId) return;
    if (tenantUrl) localStorage.setItem('selected_tenant_db', tenantUrl);

    verReporte({ _id: reporteId });
  }, [verReporte]);

  return { verReporte, compartirReporte, generarInformePDF: verReporte };
}
