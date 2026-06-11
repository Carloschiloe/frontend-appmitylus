import { CircleHelp } from 'lucide-react';
import { useMitynexTour } from '../modules/ayuda/useMitynexTour.js';
import './HelpTourButton.css';

export default function HelpTourButton({ tourId, className = '' }) {
  const startTour = useMitynexTour(tourId);

  return (
    <button type="button" className={`mx-help-tour-button ${className}`.trim()} onClick={startTour}>
      <CircleHelp size={15} />
      Guía de esta pantalla
    </button>
  );
}
