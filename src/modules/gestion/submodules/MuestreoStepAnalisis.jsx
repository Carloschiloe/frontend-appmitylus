import { useState } from 'react';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, FileText, Layers, Plus, Settings2, Target, X } from 'lucide-react';
import { fmtNum } from './muestreos.helpers';

const TABS = ['procesable', 'rechazo', 'defecto'];

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

  return (
    <div className="mu-step-container mu-analysis-step">

      {/* Panel izquierdo: parámetros de rendimiento */}
      <div className={`mu-params-side${paramsOpen ? '' : ' collapsed'}`}>
        <button
          type="button"
          className="mu-params-side-toggle"
          onClick={() => setParamsOpen((p) => !p)}
          title={paramsOpen ? 'Ocultar parámetros' : 'Ver parámetros'}
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
              <input
                type="number"
                className="mx-input mu-params-side-input"
                value={form.uxkg}
                onChange={(e) => setForm({ ...form, uxkg: e.target.value })}
                onKeyDown={handleAdvanceOnEnter}
                placeholder="0"
              />
            </div>

            <div className="mu-params-side-field">
              <label>Peso Vivo</label>
              <input
                type="number"
                className="mx-input mu-params-side-input"
                value={form.pesoVivo}
                onChange={(e) => setForm({ ...form, pesoVivo: e.target.value })}
                onKeyDown={handleAdvanceOnEnter}
                placeholder="0.00"
              />
            </div>

            <div className="mu-params-side-field">
              <label>Peso Carne</label>
              <input
                type="number"
                className="mx-input mu-params-side-input"
                value={form.pesoCocida}
                onChange={(e) => setForm({ ...form, pesoCocida: e.target.value })}
                onKeyDown={handleAdvanceOnEnter}
                placeholder="0.00"
              />
            </div>

          </div>
        )}
      </div>

      {/* Contenido principal: tabs + lista ítems */}
      <div className="mu-analysis-main">
        <div className="mu-analysis-toolbar">
          <div className="mu-analysis-section-title success">
            <Layers size={14} />
            <h4>Análisis Técnico</h4>
          </div>
        </div>

        <div className="mu-analysis-tabs">
          {TABS.map((type) => {
            const count = maestros.cats.filter((cat) => cat.tipoCat === type && selectedCats.has(cat._id)).length;
            const isActive = activeTab === type;
            return (
              <button key={type} type="button" onClick={() => setActiveTab(type)} className={`mu-analysis-tab ${isActive ? 'active' : ''}`}>
                <span>{type}s</span>
                {count > 0 && <span className="mu-analysis-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {activeTab !== 'procesable' && (
          <div className="mu-analysis-dropdown-wrap">
            <button type="button" className="mx-btn mx-btn-outline mu-analysis-dropdown-trigger" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <span>+ Añadir {activeTab}s...</span>
              <ChevronDown size={14} className={isDropdownOpen ? 'mu-rotate-180' : ''} />
            </button>

            {isDropdownOpen && (
              <>
                <div className="mu-analysis-dropdown-backdrop" onClick={() => setIsDropdownOpen(false)} />
                <div className="mu-analysis-dropdown">
                  {filteredAvailableCats.length === 0 ? (
                    <div className="mu-analysis-dropdown-empty">No hay mas items disponibles</div>
                  ) : (
                    filteredAvailableCats.map((cat) => (
                      <button key={cat._id} type="button" onClick={() => toggleCatSelection(cat._id)} className="mu-analysis-dropdown-option">
                        <Plus size={12} color="var(--color-primary)" />
                        {cat.nombre}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mu-analysis-items">
          <div className="mu-analysis-items-head">
            <span>Item</span>
            <span className="align-right">Peso</span>
            <span className="align-right">%</span>
            <span /><span /><span />
          </div>

          <div className="mu-analysis-items-body">
            {filteredSelectedCats.map((cat) => {
              const id = cat._id;
              const value = Number(form.cats[id]) || 0;
              const pct = totals.totalMuestra > 0 ? (value / totals.totalMuestra) * 100 : 0;
              const isExpanded = expandedItems.has(id);
              const legacyFotos = catDetails[id]?.fotos || [];
              const s3Photos = catDetails[id]?.photos || [];
              const hasPhotos = legacyFotos.length > 0 || s3Photos.length > 0;

              return (
                <div key={id} className="mu-analysis-item">
                  <div className={`mu-analysis-item-row ${isExpanded ? 'expanded' : ''}`}>
                    <span className="mu-analysis-item-name">{cat.nombre}</span>
                    <input type="number" className="mx-input mu-analysis-weight-input" value={form.cats[id] || ''} onChange={(e) => setForm({ ...form, cats: { ...form.cats, [id]: e.target.value } })} onKeyDown={handleAdvanceOnEnter} placeholder="0" />
                    <div className="mu-analysis-percent">{fmtNum(pct, 1)}%</div>
                    <button type="button" className="mx-btn-icon mu-analysis-icon-btn" onClick={() => { const next = new Set(expandedItems); if (next.has(id)) next.delete(id); else next.add(id); setExpandedItems(next); }} title="Observaciones">
                      <Settings2 size={12} />
                    </button>
                    <label className="mx-btn-icon mu-analysis-icon-btn mu-analysis-camera-btn" title="Agregar foto">
                      <Camera size={12} color={hasPhotos ? 'var(--color-primary)' : '#94a3b8'} />
                      <input type="file" multiple accept="image/*" className="mu-hidden-file" onChange={(e) => handleFileUpload(id, e.target.files)} />
                    </label>
                    {activeTab !== 'procesable' ? <button type="button" className="mx-btn-icon mu-analysis-icon-btn danger" onClick={() => toggleCatSelection(id)}><X size={12} /></button> : <div />}
                  </div>

                  {isExpanded && (
                    <div className="mu-analysis-item-details">
                      <textarea className="mx-input mu-analysis-detail-textarea" rows={2} placeholder="Observaciones de calidad..." value={catDetails[id]?.obs || ''} onChange={(e) => setCatDetails({ ...catDetails, [id]: { ...catDetails[id], obs: e.target.value } })} />
                      {hasPhotos && (
                        <div className="mu-evidence-row">
                          {legacyFotos.map((foto, index) => (
                            <EvidenceThumb key={`legacy-${index}`} src={foto} onPreview={setPreviewImage} onRemove={() => removePhoto(id, index, true)} />
                          ))}
                          {s3Photos.map((photo, index) => (
                            <EvidenceThumb key={`s3-${index}`} src={photo.url} onPreview={setPreviewImage} onRemove={() => removePhoto(id, index, false)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Barra de acciones compacta */}
        <div className="mu-action-bar">

          <div className="mu-action-wrap">
            <button
              type="button"
              className={`mu-action-btn${notesOpen ? ' active' : ''}`}
              onClick={() => { setNotesOpen((o) => !o); setPhotosOpen(false); }}
            >
              <FileText size={13} />
              <span>Notas</span>
              {form.comentarios?.trim() && <span className="mu-action-dot" />}
            </button>
            {notesOpen && (
              <>
                <div className="mu-action-backdrop" onClick={() => setNotesOpen(false)} />
                <div className="mu-action-popover mu-notes-popover">
                  <textarea
                    className="mx-input mu-action-notes-textarea"
                    rows={4}
                    placeholder="Observaciones del muestreo..."
                    value={form.comentarios}
                    onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          <div className="mu-action-wrap">
            <button
              type="button"
              className={`mu-action-btn${photosOpen ? ' active' : ''}`}
              onClick={() => { setPhotosOpen((o) => !o); setNotesOpen(false); }}
            >
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
                  {generalPhotos.length === 0 && (
                    <p className="mu-action-popover-empty">Agrega fotos con el botón de cámara.</p>
                  )}
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
