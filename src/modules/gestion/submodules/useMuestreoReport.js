import { useCallback, useEffect } from 'react';
import { generarHTMLReporte } from '../../reportes/renderMuestreoReport';
import { createPublicMuestreoShare, getMuestreoReportDetail } from './muestreos.api';

function copyTextInWindow(win, value) {
  const doc = win.document;
  const textarea = doc.createElement('textarea');
  textarea.value = value;
  doc.body.appendChild(textarea);
  textarea.select();
  doc.execCommand('copy');
  doc.body.removeChild(textarea);
}

function bindReportShareButtons({ win, id }) {
  setTimeout(() => {
    const copyButton = win.document.getElementById('btnCopiarEnlace');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          copyButton.innerText = 'Generando...';
          const res = await createPublicMuestreoShare(id);
          copyTextInWindow(win, res.url);
          copyButton.innerText = 'Copiado';
          setTimeout(() => { copyButton.innerText = 'Copiar enlace'; }, 2500);
        } catch {
          copyButton.innerText = 'Error';
          setTimeout(() => { copyButton.innerText = 'Copiar enlace'; }, 2500);
        }
      });
    }

    const shareButton = win.document.getElementById('btnCompartirPublico');
    if (shareButton) {
      shareButton.addEventListener('click', async () => {
        try {
          shareButton.innerText = 'Generando...';
          const res = await createPublicMuestreoShare(id);
          copyTextInWindow(win, res.url);
          shareButton.innerText = 'Copiado';
          setTimeout(() => { shareButton.innerText = 'Compartir'; }, 2500);
        } catch {
          shareButton.innerText = 'Error';
          setTimeout(() => { shareButton.innerText = 'Compartir'; }, 2500);
        }
      });
    }
  }, 300);
}

function buildShareText({ muestreo, url }) {
  const proveedor = muestreo.proveedorNombre || 'Proveedor';
  const centro = muestreo.centroCodigo || muestreo.centroNombre || 'Sin Centro';
  const fecha = muestreo.fecha ? new Date(muestreo.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const linea = muestreo.linea ? `\nLinea: ${muestreo.linea}` : '';
  const responsable = muestreo.responsable ? `\nResponsable: ${muestreo.responsable}` : '';

  return {
    proveedor,
    message:
      `*Mitynex | Informe publico de muestreo*\n` +
      `Proveedor: ${proveedor}\n` +
      `Centro: ${centro}${linea}\n` +
      `Fecha muestreo: ${fecha}${responsable}\n\n` +
      `Ver informe tecnico:\n${url}`,
  };
}

export default function useMuestreoReport({
  addToast,
  maestros,
  user,
  setIsLoadingDetails,
  setShareData,
  setIsShareModalOpen,
}) {
  const verReporte = useCallback(async (muestreo) => {
    const id = muestreo._id || muestreo.id;
    if (!id) return;

    try {
      setIsLoadingDetails(true);
      const detalle = await getMuestreoReportDetail(id);
      const logoUrl = user?.empresaId?.config?.logo || localStorage.getItem('selected_tenant_logo') || '';
      const empresaNom = user?.empresaId?.nombre || 'Mitynex';
      const html = generarHTMLReporte(detalle, { logoUrl, empresaNom, maestros });
      if (!html) return;

      const win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) {
        addToast({ title: 'Bloqueo Detectado', message: 'Habilita ventanas emergentes para generar el informe', type: 'warning' });
        return;
      }

      win.document.write(html);
      win.document.close();
      bindReportShareButtons({ win, id });
    } catch {
      addToast({ title: 'Error', message: 'No se pudo cargar el detalle del reporte.', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  }, [addToast, maestros, setIsLoadingDetails, user?.empresaId?.config?.logo, user?.empresaId?.nombre]);

  const compartirReporte = useCallback(async (muestreo) => {
    const id = muestreo._id || muestreo.id;
    if (!id) return;

    try {
      setIsLoadingDetails(true);
      const res = await createPublicMuestreoShare(id);
      const shareText = buildShareText({ muestreo, url: res.url });

      setShareData({
        url: res.url,
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
