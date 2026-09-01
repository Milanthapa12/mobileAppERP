import { useEffect, useState } from 'react';

export type LiveClock = {
  timeStr: string;
  dateStr: string;
};

export function useLiveClock(format: '12h' | '24h' = '12h'): LiveClock {
  const getFormatted = () => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let timeStr: string;
    if (format === '12h') {
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } else {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      timeStr = `${hours}:${minutes}:${seconds}`;
    }

    const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
    return { timeStr, dateStr };
  };

  const [clock, setClock] = useState<LiveClock>(getFormatted);

  useEffect(() => {
    const interval = setInterval(() => setClock(getFormatted()), 1000);
    return () => clearInterval(interval);
  }, [format]);

  return clock;
}
