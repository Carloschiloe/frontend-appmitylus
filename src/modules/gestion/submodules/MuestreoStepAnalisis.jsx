import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, FileText, Layers, MessageSquare, Target, X } from 'lucide-react';
import { fmtNum } from './muestreos.helpers';

const TYPE_COLOR = {
  procesable: 'var(--color-primary)',
  rechazo:    '#ef4444',
  defecto:    '#f59e0b',
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
  const [hiddenItems, setHiddenItems] = useState(new Set());
  const [activeItemId, setActiveItemId] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);

  const handleOpenItemPopover = (id, e) => {
    if (activeItemId === id) { setActiveItemId(null); setPopoverPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 6, left: Math.max(8, rect.left - 230) });
    setActiveItemId(id);
  };

  const handleWeightChange = (id, val) => {
    setForm({ ...form, cats: { ...form.cats, [id]: val } });
    if ((Number(val) || 0) > 0 && !selectedCats.has(id)) toggleCatSelection(id);
  };

  const hideItem = (id) => setHiddenItems((prev) => new Set([...prev, id]));

  const allItems = maestros.cats.filter((c) => !hiddenItems.has(c._id));

  return (
    <div className="mu-step-container mu-analysis-step">

      {/* Panel izquierdo */}
      <div className={`mu-params-side${paramsOpen ? '' : ' collapsed'}`}>
        <button type="button" className="mu-params-side-toggle" onClick={() => setParamsOpen((p) => !p)} title={paramsOpen ? 'Ocultar' : 'Ver'}>
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

            <div className="mu-params-side-divider" />

            <span className="mu-params-side-section-label">Evidencia General</span>

            {/* Notas inline en el panel */}
            <div className="mu-params-side-extra">
              <button type="button" className={`mu-params-extra-btn${notesOpen ? ' active' : ''}`} onClick={() => setNotesOpen((o) => !o)}>
                <FileText size={12} />
                <span>Notas</span>
                {form.comentarios?.trim() && <span className="mu-action-dot" />}
              </button>
              {notesOpen && (
                <textarea
                  className="mx-input mu-params-extra-textarea"
                  rows={3}
                  placeholder="Observaciones..."
                  value={form.comentarios}
                  onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                  autoFocus
                />
              )}
            </div>

            {/* Fotos inline en el panel */}
            <div className="mu-params-side-extra">
              <button type="button" className={`mu-params-extra-btn${photosOpen ? ' active' : ''}`} onClick={() => setPhotosOpen((o) => !o)}>
                <Camera size={12} />
                <span>Fotos</span>
                {generalPhotos.length > 0 && <span className="mu-action-badge">{generalPhotos.length}</span>}
              </button>
              {photosOpen && (
                <div className="mu-params-extra-photos">
                  <label className="mu-evidence-upload compact">
                    <Camera size={15} color="#64748b" />
                    <input type="file" multiple accept="image/*" className="mu-hidden-file" onChange={(e) => handleGeneralFileUpload(e.target.files)} />
                  </label>
                  {generalPhotos.map((photo, index) => (
                    <EvidenceThumb key={`gen-${index}`} src={photo.url} onPreview={setPreviewImage} onRemove={() => removeGeneralPhoto(index)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de ítems */}
      <div className="mu-analysis-main">
        <div className="mu-analysis-toolbar">
          <div className="mu-analysis-section-title success">
            <Layers size={14} />
            <h4>Análisis Técnico</h4>
          </div>
        </div>

        <div className="mu-analysis-items">
          <div className="mu-analysis-items-head">
            <span />
            <span>Item</span>
            <span className="align-right">Peso</span>
            <span className="align-right">%</span>
            <span />
          </div>

          <div className="mu-analysis-items-body">
            {allItems.map((cat) => {
              const id = cat._id;
              const value = Number(form.cats[id]) || 0;
              const pct = totals.totalMuestra > 0 ? (value / totals.totalMuestra) * 100 : 0;
              const hasContent = !!(catDetails[id]?.obs?.trim() || (catDetails[id]?.fotos || []).length > 0 || (catDetails[id]?.photos || []).length > 0);
              const typeColor = TYPE_COLOR[cat.tipoCat] || '#64748b';

              return (
                <div key={id} className="mu-analysis-item">
                  <div className={`mu-analysis-item-row${activeItemId === id ? ' expanded' : ''}`}>
                    <button type="button" className="mx-btn-icon mu-analysis-icon-btn mu-hide-btn" onClick={() => hideItem(id)} title="Ocultar">
                      <X size={10} />
                    </button>
                    <span className="mu-analysis-item-name" style={{ color: typeColor }}>{cat.nombre}</span>
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
                    <button type="button" className="mx-btn-icon mu-analysis-icon-btn" onClick={(e) => handleOpenItemPopover(id, e)} title="Observaciones y fotos">
                      <MessageSquare size={12} color={hasContent ? 'var(--color-primary)' : '#b0bec5'} />
                    </button>
                  </div>
                </div>
              );
            })}

            {hiddenItems.size > 0 && (
              <div className="mu-hidden-items-list">
                {maestros.cats.filter((c) => hiddenItems.has(c._id)).map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    className="mu-restore-item-btn"
                    onClick={() => setHiddenItems((prev) => { const next = new Set(prev); next.delete(cat._id); return next; })}
                    title="Agregar de vuelta"
                  >
                    <span style={{ color: TYPE_COLOR[cat.tipoCat] }}>{cat.nombre}</span>
                    <span className="mu-restore-plus">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Popover de ítem */}
        {activeItemId && popoverPos && (() => {
          const id = activeItemId;
          const legacyFotos = catDetails[id]?.fotos || [];
          const s3Photos = catDetails[id]?.photos || [];
          return (
            <>
              <div className="mu-action-backdrop" onClick={() => { setActiveItemId(null); setPopoverPos(null); }} />
              <div className="mu-item-popover" style={{ top: popoverPos.top, left: popoverPos.left }}>
                <textarea className="mx-input mu-item-popover-textarea" rows={3} placeholder="Observaciones de calidad..." value={catDetails[id]?.obs || ''} onChange={(e) => setCatDetails({ ...catDetails, [id]: { ...catDetails[id], obs: e.target.value } })} autoFocus />
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
