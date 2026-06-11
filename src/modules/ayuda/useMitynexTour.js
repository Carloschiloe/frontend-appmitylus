import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { mitynexTours } from './toursContent.js';
import './tour.css';

export function useMitynexTour(tourId) {
  const driverRef = useRef(null);

  useEffect(() => () => driverRef.current?.destroy(), []);

  return useCallback(() => {
    const tour = mitynexTours[tourId];
    if (!tour) return false;

    const steps = tour.steps
      .filter((step) => document.querySelector(step.element))
      .map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.placement || 'bottom',
          align: 'start',
        },
      }));

    if (!steps.length) return false;

    driverRef.current?.destroy();
    driverRef.current = driver({
      animate: true,
      allowClose: true,
      overlayClickBehavior: 'close',
      showProgress: true,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: 'mitynex-tour-popover',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: '{{current}} de {{total}}',
      steps,
    });
    driverRef.current.drive();
    return true;
  }, [tourId]);
}
