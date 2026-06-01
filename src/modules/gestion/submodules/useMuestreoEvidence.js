import { useCallback, useEffect, useState } from 'react';
import { deleteMuestreoEvidence, uploadMuestreoEvidence } from './muestreos.api';

export default function useMuestreoEvidence({ editingId, addToast }) {
  const [catDetails, setCatDetails] = useState({});
  const [generalPhotos, setGeneralPhotos] = useState([]);
  const [deletedPhotoKeys, setDeletedPhotoKeys] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewImage]);

  const resetEvidence = useCallback(() => {
    setCatDetails({});
    setGeneralPhotos([]);
    setDeletedPhotoKeys([]);
    setPreviewImage(null);
  }, []);

  const loadEvidence = useCallback((muestreo) => {
    setCatDetails({ ...(muestreo?.catDetails || {}) });
    setGeneralPhotos(Array.isArray(muestreo?.generalPhotos) ? muestreo.generalPhotos : []);
    setDeletedPhotoKeys([]);
    setPreviewImage(null);
  }, []);

  const handleFileUpload = useCallback(async (id, files) => {
    if (!files) return;

    const fileList = Array.from(files);

    for (const file of fileList) {
      try {
        const res = await uploadMuestreoEvidence({ file, category: id, samplingId: editingId || 'temp' });

        if (res.ok) {
          setCatDetails((prev) => {
            const current = prev[id] || { obs: '', photos: [], fotos: [] };
            return {
              ...prev,
              [id]: {
                ...current,
                photos: [...(current.photos || []), res.metadata],
              },
            };
          });
        }
      } catch {
        addToast({ title: 'Error al subir imagen', message: 'No se pudo subir la imagen. Intenta nuevamente.', type: 'error' });
      }
    }
  }, [editingId, addToast]);

  const removePhoto = useCallback((id, idx, isLegacy = false) => {
    setCatDetails((prev) => {
      const current = prev[id];
      if (!current) return prev;

      const nextDetails = { ...current };

      if (isLegacy) {
        const nextFotos = [...(current.fotos || [])];
        nextFotos.splice(idx, 1);
        nextDetails.fotos = nextFotos;
      } else {
        const nextPhotos = [...(current.photos || [])];
        const photoToDelete = nextPhotos[idx];

        if (photoToDelete?.key) {
          setDeletedPhotoKeys((prevKeys) => [...prevKeys, photoToDelete.key]);
          deleteMuestreoEvidence(photoToDelete.key).catch(() => {});
        }

        nextPhotos.splice(idx, 1);
        nextDetails.photos = nextPhotos;
      }

      return { ...prev, [id]: nextDetails };
    });
  }, []);

  const handleGeneralFileUpload = useCallback(async (files) => {
    if (!files) return;
    const fileList = Array.from(files);

    for (const file of fileList) {
      try {
        const res = await uploadMuestreoEvidence({ file, category: 'general', samplingId: editingId || 'temp' });

        if (res.ok) {
          setGeneralPhotos((prev) => [...prev, res.metadata]);
        }
      } catch {
        addToast({ title: 'Error al subir imagen', message: 'No se pudo subir la imagen. Intenta nuevamente.', type: 'error' });
      }
    }
  }, [editingId, addToast]);

  const removeGeneralPhoto = useCallback((idx) => {
    setGeneralPhotos((prev) => {
      const nextPhotos = [...prev];
      const photoToDelete = nextPhotos[idx];
      if (photoToDelete?.key) {
        setDeletedPhotoKeys((prevKeys) => [...prevKeys, photoToDelete.key]);
        deleteMuestreoEvidence(photoToDelete.key).catch(() => {});
      }
      nextPhotos.splice(idx, 1);
      return nextPhotos;
    });
  }, []);

  return {
    catDetails,
    setCatDetails,
    generalPhotos,
    deletedPhotoKeys,
    previewImage,
    setPreviewImage,
    resetEvidence,
    loadEvidence,
    handleFileUpload,
    removePhoto,
    handleGeneralFileUpload,
    removeGeneralPhoto,
  };
}
