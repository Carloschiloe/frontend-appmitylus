import { AlertTriangle } from 'lucide-react';
import { fmtDateShort, todayKey, toChileDateKey, compareDateKeys } from '../utils/fechasChile';
import {
  SEGUIMIENTO_LABELS,
  getSanitarioEstado,
  getSanitarioLabel,
  isSanitarioRelevant,
} from '../utils/programaCalculos';

// Programa cuya vigenciaHasta ya pasó pero nadie lo finalizó manualmente
// (el sistema nunca cierra programas solo — ver ProgramaEstadoBadge).
function isVencido(p) {
  if (p.estado !== 'activo' || !p.vigenciaHasta) return false;
  return compareDateKeys(toChileDateKey(p.vigenciaHasta), todayKey()) < 0;
}

export default function ProgramaEstadoBadge({ programa: p }) {
  return (
    <div className="harvest-prog-status-stack">
      <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`}>
        {(p.estado || '—').toUpperCase()}
      </span>
      {isVencido(p) && (
        <span className="mx-badge mx-badge-danger" title={`Venció el ${fmtDateShort(p.vigenciaHasta)} y sigue activo — hay que finalizarlo o ajustar la vigencia.`}>
          <AlertTriangle size={10} /> Vencido
        </span>
      )}
      {p.estado === 'pausado' && p.pausadoDesde && (
        <span className="harvest-prog-status-note">desde {fmtDateShort(p.pausadoDesde)}</span>
      )}
      {p.seguimientos?.[0] && (() => {
        const seg = SEGUIMIENTO_LABELS[p.seguimientos[0].estado];
        if (!seg) return null;
        return <span className={`mx-badge mx-badge-${seg.cls}`} style={{ fontSize: '0.7rem' }}>{seg.label}</span>;
      })()}
      {getSanitarioEstado(p.sanitario) !== 'gris' && (
        <span
          className={`harvest-prog-san-chip ${getSanitarioEstado(p.sanitario)}`}
          title={[p.sanitario?.areaPSMB, p.sanitario?.codigoArea ? `Area ${p.sanitario.codigoArea}` : ''].filter(Boolean).join(' - ')}
        >
          {isSanitarioRelevant(p.sanitario) && <AlertTriangle size={10} />}
          {getSanitarioLabel(p.sanitario)}
        </span>
      )}
    </div>
  );
}
