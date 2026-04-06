import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, getDaysInMonth, addMonths, parseISO } from '../utils/dateUtils';
import { ReservationModal } from './ReservationModal';
import { Reservation } from '../../types';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_HEADERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const STATUS_DOT: Record<string, string> = {
  réservé: 'bg-emerald-500',
  check_in: 'bg-amber-400',
  en_attente: 'bg-amber-400',
  terminé: 'bg-teal-400',
  check_out: 'bg-teal-400',
  annulé: 'bg-red-400',
  bloqué: 'bg-slate-500',
};

export function CalendarView() {
  const { reservations, terrains } = useData();
  const { hasPermission } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newResSlot, setNewResSlot] = useState<{ date: Date; terrainId?: string } | null>(null);
  const [showDayDetail, setShowDayDetail] = useState(false);

  const canManage = hasPermission('manage_reservations');

  const monthDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const getReservationsForDay = (date: Date) =>
    reservations.filter((r) => isSameDay(new Date(r.date_debut), date));

  const navigate = (dir: number) => setCurrentDate(addMonths(currentDate, dir));

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayDetail(true);
  };

  const handleNewReservation = () => {
    setNewResSlot({ date: selectedDate || new Date() });
    setSelectedReservation(null);
    setShowModal(true);
    setShowDayDetail(false);
  };

  const startPadding = monthDays.length > 0 ? monthDays[0].getDay() : 0;

  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const today = new Date();

  const selectedDayReservations = selectedDate ? getReservationsForDay(selectedDate) : [];

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-2xl font-bold text-white">Calendrier</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-lg font-bold text-white mb-3">{monthLabel}</h2>

          <div className="flex items-center gap-3 mb-4">
            {canManage && (
              <button
                onClick={() => { setNewResSlot({ date: selectedDate || new Date() }); setSelectedReservation(null); setShowModal(true); }}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                Reserver
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(1)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((d, i) => (
              <div key={i} className="text-center py-1">
                <span className="text-xs font-medium text-slate-500">{d}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startPadding }, (_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}

            {monthDays.map((day, i) => {
              const resos = getReservationsForDay(day);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const hasResos = resos.length > 0;
              const count = resos.length;

              const statusGroups: Record<string, number> = {};
              resos.forEach((r) => {
                const key = r.statut;
                statusGroups[key] = (statusGroups[key] || 0) + 1;
              });

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`
                    relative flex flex-col items-center py-1.5 rounded-xl transition-all
                    ${isSelected && !isToday ? 'bg-slate-700/60' : ''}
                    ${isToday ? 'bg-emerald-500/10' : 'hover:bg-slate-800/50'}
                  `}
                >
                  <span className={`
                    text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-all
                    ${isToday ? 'bg-emerald-500 text-white' : isSelected ? 'text-emerald-400' : 'text-slate-300'}
                  `}>
                    {day.getDate()}
                  </span>
                  {hasResos && (
                    <span className="text-xs text-slate-400 font-medium leading-none mt-0.5">
                      {count}
                    </span>
                  )}
                  {hasResos && (
                    <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: getDominantColor(resos) }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800">
          <p className="text-sm font-semibold text-white mb-2">Legende</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <LegendItem color="bg-emerald-500" label="Reserve" />
            <LegendItem color="bg-teal-400" label="Termine" />
            <LegendItem color="bg-amber-400" label="En cours" />
            <LegendItem color="bg-red-400" label="Annule" />
          </div>
        </div>
      </div>

      {showDayDetail && selectedDate && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">
                {MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}, {selectedDate.getFullYear()}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedDayReservations.length} réservation{selectedDayReservations.length !== 1 ? 's' : ''}
              </p>
            </div>
            {canManage && (
              <button
                onClick={handleNewReservation}
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border border-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            )}
          </div>

          {selectedDayReservations.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              Aucune réservation ce jour
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {selectedDayReservations.map((r) => {
                const start = new Date(r.date_debut);
                const end = new Date(r.date_fin);
                const pad = (n: number) => String(n).padStart(2, '0');
                const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;

                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedReservation(r); setShowModal(true); setShowDayDetail(false); }}
                    className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[r.statut] || 'bg-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{r.client_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.terrain?.name || ''} · {timeStr}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white">{fmt(r.amount_due)}</p>
                      <p className={`text-xs mt-0.5 ${
                        r.statut === 'réservé' ? 'text-emerald-400' :
                        r.statut === 'check_in' ? 'text-amber-400' :
                        r.statut === 'terminé' || r.statut === 'check_out' ? 'text-teal-400' :
                        r.statut === 'annulé' ? 'text-red-400' : 'text-slate-500'
                      }`}>
                        {r.statut === 'réservé' ? 'Réservé' :
                          r.statut === 'check_in' ? 'En cours' :
                          r.statut === 'terminé' || r.statut === 'check_out' ? 'Terminé' :
                          r.statut === 'annulé' ? 'Annulé' : r.statut}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ReservationModal
          reservation={selectedReservation}
          initialDate={newResSlot?.date}
          initialTerrainId={newResSlot?.terrainId}
          onClose={() => { setShowModal(false); setSelectedReservation(null); setNewResSlot(null); }}
        />
      )}
    </div>
  );
}

function getDominantColor(reservations: Reservation[]): string {
  const priority = ['check_in', 'en_attente', 'réservé', 'terminé', 'check_out', 'annulé'];
  for (const status of priority) {
    if (reservations.some((r) => r.statut === status)) {
      const colors: Record<string, string> = {
        réservé: '#10b981',
        check_in: '#fbbf24',
        en_attente: '#fbbf24',
        terminé: '#2dd4bf',
        check_out: '#2dd4bf',
        annulé: '#f87171',
      };
      return colors[status] || '#64748b';
    }
  }
  return '#64748b';
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-xs text-slate-300">{label}</span>
    </div>
  );
}
