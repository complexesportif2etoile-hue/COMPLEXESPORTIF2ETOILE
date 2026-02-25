import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { CardShell } from '../ui/CardShell';
import { IconPill } from '../ui/IconPill';
import { CalendarReservationModal } from './CalendarReservationModal';

export const CalendarView: React.FC = () => {
  const { reservations, terrains } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const activeTerrains = useMemo(() => terrains.filter((t) => t.is_active), [terrains]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const monthNames = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
  ];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayNamesShort = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const reservationsByDay = useMemo(() => {
    const map: Record<string, typeof reservations> = {};
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    for (const r of reservations) {
      if (r.statut === 'terminé' || r.statut === 'annulé') continue;
      if (r.date_debut.startsWith(yearMonth)) {
        const day = r.date_debut.substring(8, 10);
        if (!map[day]) map[day] = [];
        map[day].push(r);
      }
    }
    return map;
  }, [reservations, currentDate]);

  const getReservationsForDay = (day: number) => reservationsByDay[String(day).padStart(2, '0')] || [];

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear();

  const isPastDay = (day: number) => {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dayDate < todayStart;
  };

  const handleDayClick = (day: number) => {
    if (isPastDay(day)) return;
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${dayStr}`);
  };

  return (
    <div className="space-y-3 xs:space-y-4 sm:space-y-6">
      <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white tracking-tight">Calendrier</h1>

      <CardShell padding="sm">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 xs:gap-2 mb-4 sm:mb-6 px-1 sm:px-2">
          <h2 className="text-base xs:text-lg sm:text-2xl font-bold text-white truncate">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                setSelectedDate(todayDate);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 xs:px-3 min-h-[40px] xs:min-h-[44px] text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Reserver</span>
            </button>
            <div className="flex gap-1.5 xs:gap-2">
              <IconPill
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                title="Mois precedent"
              >
                <ChevronLeft className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
              </IconPill>
              <IconPill
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                title="Mois suivant"
              >
                <ChevronRight className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
              </IconPill>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5 xs:gap-1 sm:gap-2 mb-2">
          {dayNames.map((day, i) => (
            <div key={day} className="text-center font-semibold text-slate-500 text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider p-0.5 xs:p-1 sm:p-2">
              <span className="hidden xs:inline">{dayNamesShort[i]}</span>
              <span className="xs:hidden">{dayNamesShort[i].charAt(0)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 xs:gap-1 sm:gap-2">
          {days.map((day, index) => {
            const reservationsForDay = day ? getReservationsForDay(day) : [];
            const todayClass = day && isToday(day);
            const pastDay = day && isPastDay(day);
            const hasReservations = reservationsForDay.length > 0;
            return (
              <div
                key={index}
                onClick={() => day && handleDayClick(day)}
                className={`min-h-14 xs:min-h-16 sm:min-h-24 p-0.5 xs:p-1 sm:p-2 rounded-lg xs:rounded-xl sm:rounded-2xl border transition-all duration-200 ${
                  day
                    ? pastDay
                      ? 'bg-slate-800/10 border-slate-700/20 opacity-40 cursor-not-allowed'
                      : todayClass
                      ? 'bg-emerald-500/5 border-emerald-500/30 ring-1 ring-emerald-500/10 cursor-pointer hover:bg-emerald-500/10'
                      : 'bg-slate-800/30 border-slate-700/40 hover:border-emerald-500/40 hover:bg-slate-800/50 cursor-pointer'
                    : 'bg-transparent border-transparent'
                }`}
              >
                {day && (
                  <>
                    <div className={`text-[10px] xs:text-xs sm:text-sm font-semibold mb-0.5 xs:mb-1 ${
                      pastDay ? 'text-slate-600' : todayClass ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {day}
                    </div>
                    {hasReservations && (
                      <div className="flex flex-col gap-0.5">
                        <div className={`w-full h-0.5 xs:h-1 rounded-full ${
                          reservationsForDay.some(r => r.statut === 'check_in')
                            ? 'bg-amber-400'
                            : reservationsForDay.some(r => r.statut === 'réservé')
                              ? 'bg-emerald-400'
                              : 'bg-teal-400'
                        }`} />
                        <div className="text-[8px] xs:text-[9px] text-slate-400 font-medium text-center">
                          {reservationsForDay.length}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardShell>

      <CardShell padding="md">
        <h3 className="text-xs xs:text-sm sm:text-base font-semibold text-white mb-2 xs:mb-3 sm:mb-4">Legende</h3>
        <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 xs:gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 xs:gap-2">
            <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 bg-emerald-400 rounded-full shrink-0 ring-2 ring-emerald-400/20" />
            <span className="text-[10px] xs:text-xs sm:text-sm text-slate-300">Reserve</span>
          </div>
          <div className="flex items-center gap-1.5 xs:gap-2">
            <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 bg-teal-400 rounded-full shrink-0 ring-2 ring-teal-400/20" />
            <span className="text-[10px] xs:text-xs sm:text-sm text-slate-300">Termine</span>
          </div>
          <div className="flex items-center gap-1.5 xs:gap-2">
            <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 bg-amber-400 rounded-full shrink-0 ring-2 ring-amber-400/20" />
            <span className="text-[10px] xs:text-xs sm:text-sm text-slate-300">En cours</span>
          </div>
          <div className="flex items-center gap-1.5 xs:gap-2">
            <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 bg-red-400 rounded-full shrink-0 ring-2 ring-red-400/20" />
            <span className="text-[10px] xs:text-xs sm:text-sm text-slate-300">Annule</span>
          </div>
        </div>
      </CardShell>

      {selectedDate && (
        <CalendarReservationModal
          selectedDate={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
};
