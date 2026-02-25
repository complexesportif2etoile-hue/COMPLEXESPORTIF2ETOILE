import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, getDaysInMonth, addMonths, parseISO } from '../utils/dateUtils';
import { ReservationModal } from './ReservationModal';
import { Reservation } from '../../types';

type ViewMode = 'week' | 'month';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

const STATUS_COLORS: Record<string, string> = {
  réservé: 'bg-blue-500/80 border-blue-400 text-white',
  check_in: 'bg-emerald-500/80 border-emerald-400 text-white',
  en_attente: 'bg-amber-500/80 border-amber-400 text-white',
  terminé: 'bg-slate-600/80 border-slate-500 text-slate-300',
  annulé: 'bg-red-500/20 border-red-500/40 text-red-400',
  bloqué: 'bg-slate-800/80 border-slate-700 text-slate-400',
  check_out: 'bg-teal-500/80 border-teal-400 text-white',
};

export function CalendarView() {
  const { reservations, terrains } = useData();
  const { hasPermission } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newResSlot, setNewResSlot] = useState<{ date: Date; terrainId: string } | null>(null);
  const [selectedTerrainFilter, setSelectedTerrainFilter] = useState<string>('all');

  const canManage = hasPermission('manage_reservations');

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const monthDays = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const filteredTerrains = useMemo(() =>
    selectedTerrainFilter === 'all' ? terrains : terrains.filter((t) => t.id === selectedTerrainFilter),
    [terrains, selectedTerrainFilter]
  );

  const getReservationsForSlot = (date: Date, terrainId: string) => {
    return reservations.filter((r) => {
      if (r.terrain_id !== terrainId) return false;
      const start = new Date(r.date_debut);
      const end = new Date(r.date_fin);
      return isSameDay(start, date) && r.statut !== 'annulé';
    });
  };

  const getReservationsForDay = (date: Date) => {
    return reservations.filter((r) => {
      const start = new Date(r.date_debut);
      return isSameDay(start, date) && r.statut !== 'annulé';
    });
  };

  const navigate = (direction: number) => {
    if (viewMode === 'week') {
      setCurrentDate(addDays(currentDate, direction * 7));
    } else {
      setCurrentDate(addMonths(currentDate, direction));
    }
  };

  const handleSlotClick = (date: Date, hour: number, terrainId: string) => {
    if (!canManage) return;
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    setNewResSlot({ date: slotDate, terrainId });
    setSelectedReservation(null);
    setShowModal(true);
  };

  const title = viewMode === 'week'
    ? `${format(weekDays[0], 'dd/MM')} – ${format(weekDays[6], 'dd/MM/yyyy')}`
    : format(currentDate, 'MM/yyyy');

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendrier</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gérez vos réservations de terrains</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedTerrainFilter}
            onChange={(e) => setSelectedTerrainFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Tous les terrains</option>
            {terrains.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex bg-slate-800 rounded-xl border border-slate-700 p-1 gap-1">
            {(['week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${viewMode === mode ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {mode === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          {canManage && (
            <button
              onClick={() => { setNewResSlot(null); setSelectedReservation(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Réserver
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-slate-200 min-w-32 text-center">{title}</span>
        <button onClick={() => navigate(1)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-all"
        >
          Aujourd'hui
        </button>
      </div>

      {viewMode === 'week' ? (
        <WeekView
          weekDays={weekDays}
          terrains={filteredTerrains}
          hours={HOURS}
          onSlotClick={handleSlotClick}
          onResClick={(r) => { setSelectedReservation(r); setShowModal(true); }}
          getReservations={getReservationsForSlot}
          canManage={canManage}
        />
      ) : (
        <MonthView
          days={monthDays}
          currentDate={currentDate}
          getReservations={getReservationsForDay}
          onDayClick={(date) => { setCurrentDate(date); setViewMode('week'); }}
        />
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

function WeekView({ weekDays, terrains, hours, onSlotClick, onResClick, getReservations, canManage }: {
  weekDays: Date[];
  terrains: { id: string; name: string }[];
  hours: number[];
  onSlotClick: (date: Date, hour: number, terrainId: string) => void;
  onResClick: (r: Reservation) => void;
  getReservations: (date: Date, terrainId: string) => Reservation[];
  canManage: boolean;
}) {
  const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const today = new Date();

  return (
    <div className="flex-1 overflow-auto bg-slate-900 rounded-2xl border border-slate-800">
      <div className="min-w-[700px]">
        <div className="grid sticky top-0 z-10 bg-slate-900 border-b border-slate-800" style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)` }}>
          <div className="border-r border-slate-800" />
          {weekDays.map((day, i) => (
            <div key={i} className={`p-2 text-center border-r border-slate-800 last:border-r-0 ${isSameDay(day, today) ? 'bg-emerald-500/5' : ''}`}>
              <p className="text-xs text-slate-500">{DAY_LABELS[i]}</p>
              <p className={`text-sm font-semibold ${isSameDay(day, today) ? 'text-emerald-400' : 'text-slate-200'}`}>
                {format(day, 'dd')}
              </p>
            </div>
          ))}
        </div>

        {terrains.map((terrain) => (
          <div key={terrain.id} className="border-b border-slate-800 last:border-b-0">
            <div className="sticky left-0 bg-slate-900/80 px-2 py-1.5 border-b border-slate-800/50">
              <p className="text-xs font-medium text-emerald-400 truncate">{terrain.name}</p>
            </div>
            {hours.map((hour) => (
              <div key={hour} className="grid border-b border-slate-800/30 last:border-b-0" style={{ gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)` }}>
                <div className="border-r border-slate-800 flex items-center justify-end pr-2">
                  <span className="text-xs text-slate-600">{String(hour).padStart(2, '0')}h</span>
                </div>
                {weekDays.map((day, i) => {
                  const resos = getReservations(day, terrain.id).filter((r) => {
                    const h = new Date(r.date_debut).getHours();
                    return h === hour;
                  });
                  return (
                    <div
                      key={i}
                      onClick={() => onSlotClick(day, hour, terrain.id)}
                      className={`border-r border-slate-800/50 last:border-r-0 min-h-[40px] p-0.5 ${canManage ? 'cursor-pointer hover:bg-slate-800/30' : ''} ${isSameDay(day, new Date()) ? 'bg-emerald-500/3' : ''}`}
                    >
                      {resos.map((r) => (
                        <div
                          key={r.id}
                          onClick={(e) => { e.stopPropagation(); onResClick(r); }}
                          className={`text-xs rounded p-1 mb-0.5 border cursor-pointer hover:opacity-90 transition-opacity truncate ${STATUS_COLORS[r.statut] || STATUS_COLORS.réservé}`}
                        >
                          {r.client_name}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ days, currentDate, getReservations, onDayClick }: {
  days: Date[];
  currentDate: Date;
  getReservations: (date: Date) => Reservation[];
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  const startPad = (days[0].getDay() + 6) % 7;
  const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-800">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }, (_, i) => (
          <div key={`pad-${i}`} className="border-b border-r border-slate-800/50 min-h-[80px]" />
        ))}
        {days.map((day, i) => {
          const resos = getReservations(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`border-b border-r border-slate-800/50 min-h-[80px] p-1.5 cursor-pointer hover:bg-slate-800/40 transition-colors last:border-r-0 ${isSameDay(day, today) ? 'bg-emerald-500/5' : ''}`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isSameDay(day, today) ? 'bg-emerald-500 text-white' : isCurrentMonth ? 'text-slate-300' : 'text-slate-600'}`}>
                {format(day, 'dd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {resos.slice(0, 3).map((r) => (
                  <div key={r.id} className={`text-xs px-1 rounded truncate ${STATUS_COLORS[r.statut] || STATUS_COLORS.réservé}`}>
                    {r.client_name}
                  </div>
                ))}
                {resos.length > 3 && (
                  <div className="text-xs text-slate-500 pl-1">+{resos.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
