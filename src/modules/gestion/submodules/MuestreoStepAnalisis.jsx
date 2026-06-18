import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, FileText, Layers, Settings2, Target, X } from 'lucide-react';
import { fmtNum } from './muestreos.helpers';

const GROUP_META = {
  procesable: { label: 'Procesables', color: '#22c55e' },
  rechazo:    { label: 'Rechazos',    color: '#ef4444' },
  defecto:    { label: 'Defectos',    color: '#f59e0b' },
};

export default function MuestreoStepAnalisis({
  form,
  setForm,
  maestros,
  selectedCats,
  activeTab,
  setActiveTab,
  isDropdownOpen,
  setIsDropdownOpen,
  filteredAvailableCats,
  filteredSelectedCats,
  toggleCatSelection,
  expandedItems,
  setExpandedItems,
  totals,
  catDetails,
  setCatDetails,
  generalPhotos,
  setPreviewImage,
  handleAdvanceOnEnter,
  handleFileUpload,
  removePhoto,
  handleGeneralFileUpload,
  removeGeneralPhoto,
}) {
  const [paramsOpen, setParamsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);

  const handleOpenItemPopover = (id, e) => {
    if (activeItemId === id) {
      setActiveItemId(null);
      setPopoverPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 6, left: Math.max(8, rect.left - 230) });
      setActiveItemId(id);
    }
  };

  const closeItemPopover = () => {
    setActiveItemId(null);
    setPopoverPos(null);
  };

  // Todos los ítems de maestros agrupados — sin filtro de selección
  const groupedCats = Object.keys(GROUP_META).map((type) => ({
    type,
    ...GROUP_META[type],
    items: maestros.cats.filter((c) => c.tipoCat === type),
  }));

  const handleWeightChange = (id, val) => {
    setForm({ ...form, cats: { ...form.cats, [id]: val } });
    // Auto-agregar a selectedCats la primera vez que se ingresa un valor
    if ((Number(val) || 0) > 0 && !selectedCats.has(id)) {
      toggleCatSelection(id);
    }
  };

  return (
    <div className="mu-step-container mu-analysis-step">

      {/* Panel izquierdo: parámetros */}
      <div className={`mu-params-side${paramsOpen ? '' : ' collapsed'}`}>
        <button
          type="button"
          className="mu-params-side-toggle"
          onClick={() => setParamsOpen((p) => !p)}
          title={paramsOpen ? 'Ocultar' : 'Ver parámetros'}
        >
          {paramsOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {paramsOpen && (
          <div className="mu-params-side-content">
            <div className="mu-params-side-title">
              <Target size={12} />
              <span>Rdmto y uk</span>
            </div>

            <div className="mu-params-side-field">
              <label>U×Kg</label>
              <input type="number" className="mx-input mu-params-side-input" value={form.uxkg} onChange={(e) => setForm({ ...form, uxkg: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0" />
            </div>
            <div className="mu-params-side-field">
              <label>Peso Vivo</label>
              <input type="number" className="mx-input mu-params-side-input" value={form.pesoVivo} onChange={(e) => setForm({ ...form, pesoVivo: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
            </div>
            <div className="mu-params-side-field">
              <label>Peso Carne</label>
              <input type="number" className="mx-input mu-params-side-input" value={form.pesoCocida} onChange={(e) => setForm({ ...form, pesoCocida: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
            </div>
          </div>
        )}
      </div>

      {/* Contenido principal */}
      <div className="mu-analysis-main">
        <div className="mu-analysis-toolbar">
          <div className="mu-analysis-section-title success">
            <Layers size={14} />
            <h4>Análisis Técnico</h4>
          </div>
        </div>

        <div className="mu-analysis-items">
          <div className="mu-analysis-items-head">
            <span>Item</span>
            <span className="align-right">Peso</span>
            <span className="align-right">%</span>
            <span />
          </div>

          <div className="mu-analysis-items-body">
            {groupedCats.map((group) => (
              <div key={group.type} className="mu-analysis-group">
                <div className="mu-group-separator">
                  <div className="mu-group-line" style={{ backgroundColor: group.color }} />
                  <span className="mu-group-label" style={{ color: group.color }}>{group.label}</span>
                </div>

                {group.items.map((cat) => {
                  const id = cat._id;
                  const value = Number(form.cats[id]) || 0;
                  const pct = totals.totalMuestra > 0 ? (value / totals.totalMuestra) * 100 : 0;
                  const hasContent = !!(catDetails[id]?.obs?.trim() || (catDetails[id]?.fotos || []).length > 0 || (catDetails[id]?.photos || []).length > 0);

                  return (
                    <div key={id} className="mu-analysis-item">
                      <div className={`mu-analysis-item-row${activeItemId === id ? ' expanded' : ''}`}>
                        <span className="mu-analysis-item-name">{cat.nombre}</span>
                        <input
                          type="number"
                          className="mx-input mu-analysis-weight-input"
                          value={form.cats[id] || ''}
                          onChange={(e) => handleWeightChange(id, e.target.value)}
                          onKeyDown={handleAdvanceOnEnter}
                          placeholder="0"
                        />
                        <div className={`mu-analysis-percent${value > 0 ? ' active' : ''}`}>
                          {value > 0 ? `${fmtNum(pct, 1)}%` : '—'}
                        </div>
                        <button
                          type="button"
                          className="mx-btn-icon mu-analysis-icon-btn"
                          onClick={(e) => handleOpenItemPopover(id, e)}
                          title="Observaciones y fotos"
                        >
                          <Settings2 size={12} color={hasContent ? 'var(--color-primary)' : undefined} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Popover de ítem */}
        {activeItemId && popoverPos && (() => {
          const id = activeItemId;
          const legacyFotos = catDetails[id]?.fotos || [];
          const s3Photos = catDetails[id]?.photos || [];
          return (
            <>
              <div className="mu-action-backdrop" onClick={closeItemPopover} />
              <div className="mu-item-popover" style={{ top: popoverPos.top, left: popoverPos.left }}>
                <textarea
                  className="mx-input mu-item-popover-textarea"
                  rows={3}
                  placeholder="Observaciones de calidad..."
                  value={catDetails[id]?.obs || ''}
                  onChange={(e) => setCatDetails({ ...catDetails, [id]: { ...catDetails[id], obs: e.target.value } })}
                  autoFocus
                />
                <div className="mu-item-popover-photos">
                  <label className="mu-evidence-upload compact" title="Agregar foto">
                    <Camera size={15} color="#64748b" />
                    <input type="file" multiple accept="image/*" className="mu-hidden-file" onChange={(e) => handleFileUpload(id, e.target.files)} />
                  </label>
                  {legacyFotos.map((foto, index) => (
                    <EvidenceThumb key={`legacy-${index}`} src={foto} onPreview={setPreviewImage} onRemove={() => removePhoto(id, index, true)} />
                  ))}
                  {s3Photos.map((photo, index) => (
                    <EvidenceThumb key={`s3-${index}`} src={photo.url} onPreview={setPreviewImage} onRemove={() => removePhoto(id, index, false)} />
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        {/* Barra de acciones */}
        <div className="mu-action-bar">
          <div className="mu-action-wrap">
            <button type="button" className={`mu-action-btn${notesOpen ? ' active' : ''}`} onClick={() => { setNotesOpen((o) => !o); setPhotosOpen(false); }}>
              <FileText size={13} />
              <span>Notas</span>
              {form.comentarios?.trim() && <span className="mu-action-dot" />}
            </button>
            {notesOpen && (
              <>
                <div className="mu-action-backdrop" onClick={() => setNotesOpen(false)} />
                <div className="mu-action-popover mu-notes-popover">
                  <textarea className="mx-input mu-action-notes-textarea" rows={4} placeholder="Observaciones del muestreo..." value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} autoFocus />
                </div>
              </>
            )}
          </div>

          <div className="mu-action-wrap">
            <button type="button" className={`mu-action-btn${photosOpen ? ' active' : ''}`} onClick={() => { setPhotosOpen((o) => !o); setNotesOpen(false); }}>
              <Camera size={13} />
              <span>Fotos generales</span>
              {generalPhotos.length > 0 && <span className="mu-action-badge">{generalPhotos.length}</span>}
            </button>
            {photosOpen && (
              <>
                <div className="mu-action-backdrop" onClick={() => setPhotosOpen(false)} />
                <div className="mu-action-popover mu-photos-popover">
                  <div className="mu-evidence-row">
                    <label className="mu-evidence-upload">
                      <Camera size={18} color="#64748b" />
                      <input type="file" multiple accept="image/*" className="mu-hidden-file" onChange={(e) => handleGeneralFileUpload(e.target.files)} />
                    </label>
                    {generalPhotos.map((photo, index) => (
                      <EvidenceThumb key={`gen-${index}`} src={photo.url} onPreview={setPreviewImage} onRemove={() => removeGeneralPhoto(index)} />
                    ))}
                  </div>
                  {generalPhotos.length === 0 && <p className="mu-action-popover-empty">Agrega fotos con el botón de cámara.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceThumb({ src, onPreview, onRemove }) {
  return (
    <div className="mu-evidence-thumb">
      <img src={src} onClick={() => onPreview(src)} className="mu-evidence-thumb-img" />
      <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="mu-evidence-thumb-remove">
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  );
}
