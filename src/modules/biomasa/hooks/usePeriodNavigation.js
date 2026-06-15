import { useState, useCallback } from 'react';

function stepMes(current, direction) {
  const [y, m] = current.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + direction, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function usePeriodNavigation({ setMes }) {
  const [programPeriod, setProgramPeriod] = useState('month');
  const [followupPeriod, setFollowupPeriod] = useState('week');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const moveProgramPeriod = useCallback((direction) => {
    if (programPeriod === 'week') {
      setCurrentWeekOffset((o) => o + direction);
      return;
    }
    setMes((prev) => stepMes(prev, direction));
  }, [programPeriod, setMes]);

  const moveFollowupPeriod = useCallback((direction) => {
    if (followupPeriod === 'week') {
      setCurrentWeekOffset((o) => o + direction);
      return;
    }
    setMes((prev) => stepMes(prev, direction));
  }, [followupPeriod, setMes]);

  return {
    programPeriod, setProgramPeriod,
    followupPeriod, setFollowupPeriod,
    currentWeekOffset, setCurrentWeekOffset,
    moveProgramPeriod,
    moveFollowupPeriod,
  };
}
