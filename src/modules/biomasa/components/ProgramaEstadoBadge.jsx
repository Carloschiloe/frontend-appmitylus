import { AlertTriangle } from 'lucide-react';
import { fmtDateShort } from '../utils/fechasChile';
import {
  SEGUIMIENTO_LABELS,
  getSanitarioEstado,
  getSanitarioLabel,
  isSanitarioRelevant,
} from '../utils/programaCalculos';

export default function ProgramaEstadoBadge({ programa: p }) {
  return (
    <div className="harvest-prog-status-stack">
      <span className={`mx-badge mx-badge-${p.estado === 'activo' ? 'success' : p.estado === 'pausado' ? 'warning' : 'muted'}`}>
        {(p.estado || '—').toUpperCase()}
      </span>
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
