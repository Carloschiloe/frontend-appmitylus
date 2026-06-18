import { Camera, ChevronDown, Layers, Plus, Settings2, Target, X } from 'lucide-react';
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
  return (
    <div className="mu-step-container mu-analysis-step">

      {/* Franja de parámetros — horizontal */}
      <div className="mu-analysis-params-bar">
        <div className="mu-params-bar-title">
          <Target size={13} />
          <span>Parámetros</span>
        </div>
        <div className="mu-params-bar-fields">
          <div className="mu-params-bar-field">
            <label>U×Kg</label>
            <input type="number" className="mx-input mu-params-bar-input" value={form.uxkg} onChange={(e) => setForm({ ...form, uxkg: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0" />
          </div>
          <div className="mu-params-bar-field">
            <label>Peso Vivo</label>
            <input type="number" className="mx-input mu-params-bar-input" value={form.pesoVivo} onChange={(e) => setForm({ ...form, pesoVivo: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
          </div>
          <div className="mu-params-bar-field">
            <label>Peso Carne</label>
            <input type="number" className="mx-input mu-params-bar-input" value={form.pesoCocida} onChange={(e) => setForm({ ...form, pesoCocida: e.target.value })} onKeyDown={handleAdvanceOnEnter} placeholder="0.00" />
          </div>
        </div>
        <select
          className="mx-select mu-analysis-unit"
          value={form.unidadPeso || 'kg'}
          onChange={(e) => setForm({ ...form, unidadPeso: e.target.value })}
        >
          <option value="kg">kg</option>
          <option value="g">g</option>
        </select>
      </div>

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

        <div className="mu-analysis-notes">
          <label className="mx-label mu-analysis-notes-label">Obs. Muestreo</label>
          <textarea
            className="mx-input mu-analysis-notes-input"
            placeholder="Notas..."
            value={form.comentarios}
            onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
          />
        </div>

        <div className="mu-general-evidence">
          <h4>Evidencias generales del muestreo</h4>
          <div className="mu-evidence-row">
            <label className="mu-evidence-upload">
              <Camera size={20} color="#64748b" />
              <input type="file" multiple accept="image/*" className="mu-hidden-file" onChange={(event) => handleGeneralFileUpload(event.target.files)} />
            </label>
            {generalPhotos.map((photo, index) => (
              <EvidenceThumb key={`gen-${index}`} src={photo.url} onPreview={setPreviewImage} onRemove={() => removeGeneralPhoto(index)} />
            ))}
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
      <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} className="mu-evidence-thumb-remove">
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  );
}
