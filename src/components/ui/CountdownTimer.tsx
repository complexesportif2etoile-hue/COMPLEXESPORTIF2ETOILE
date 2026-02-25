import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CountdownTimerProps {
  endDate: string;
  reservationId: string;
  onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  endDate,
  reservationId,
  onExpire,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;
      return Math.max(0, difference);
    };

    const updateTimeLeft = () => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0 && !hasExpired) {
        setHasExpired(true);
        handleExpiration();
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate, hasExpired]);

  const handleExpiration = async () => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ statut: 'terminé' })
        .eq('id', reservationId);

      if (error) {
        console.error('Error updating reservation status:', error);
      } else {
        onExpire?.();
      }
    } catch (err) {
      console.error('Error in handleExpiration:', err);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  };

  const time = formatTime(timeLeft);
  const isWarning = timeLeft < 300000;
  const isDanger = timeLeft < 60000;

  if (hasExpired || timeLeft === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20">
        <AlertCircle className="w-4 h-4 text-teal-400" />
        <span className="text-xs font-semibold text-teal-400">Session terminee</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors duration-300 ${
        isDanger
          ? 'bg-red-500/10 border-red-500/30 animate-pulse'
          : isWarning
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
      }`}
    >
      <Clock
        className={`w-4 h-4 ${
          isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
        }`}
      />
      <div className="flex items-center gap-1 font-mono">
        <span
          className={`text-sm font-bold ${
            isDanger ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-emerald-300'
          }`}
        >
          {time.hours}:{time.minutes}:{time.seconds}
        </span>
      </div>
    </div>
  );
};
