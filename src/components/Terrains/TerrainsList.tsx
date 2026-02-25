import React, { useState } from 'react';
import { supabase, Terrain } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, MapPin, ToggleLeft, ToggleRight } from 'lucide-react';
import { CardShell } from '../ui/CardShell';
import { IconPill } from '../ui/IconPill';
import { TerrainFormModal } from './TerrainFormModal';
import { DeleteTerrainModal } from './DeleteTerrainModal';

export const TerrainsList: React.FC = () => {
  const { terrains, refreshTerrains } = useData();
  const { can } = useAuth();
  const canManage = can('manage_terrains');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTerrain, setEditingTerrain] = useState<Terrain | null>(null);
  const [deletingTerrain, setDeletingTerrain] = useState<Terrain | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = async (terrain: Terrain) => {
    setTogglingId(terrain.id);
    try {
      const { error } = await supabase
        .from('terrains')
        .update({ is_active: !terrain.is_active, updated_at: new Date().toISOString() })
        .eq('id', terrain.id);
      if (error) throw error;
      await refreshTerrains();
    } catch (error) {
      console.error('Error toggling terrain:', error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenCreate = () => {
    setEditingTerrain(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (terrain: Terrain) => {
    setEditingTerrain(terrain);
    setShowFormModal(true);
  };

  const handleFormSaved = () => {
    setShowFormModal(false);
    setEditingTerrain(null);
    refreshTerrains();
  };

  const handleDeleted = () => {
    setDeletingTerrain(null);
    refreshTerrains();
  };


  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">Terrains</h1>
          <p className="text-xs xs:text-sm sm:text-base text-slate-400 mt-1">
            {terrains.length} terrain{terrains.length !== 1 ? 's' : ''} configure
            {terrains.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-3 xs:px-4 sm:px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs xs:text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Nouveau Terrain</span>
            <span className="xs:hidden">Nouveau</span>
          </button>
        )}
      </div>

      {/* Terrain cards grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-5">
        {terrains.map((terrain) => (
          <CardShell key={terrain.id} hover>
            <div className="flex flex-col gap-3 xs:gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 xs:gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 xs:w-10 xs:h-10 bg-emerald-500/10 rounded-lg xs:rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/20 ring-1 ring-emerald-500/5">
                    <MapPin className="w-4 h-4 xs:w-5 xs:h-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-white truncate">{terrain.name}</h3>
                    <p className="text-[10px] xs:text-xs sm:text-sm text-slate-500 truncate">{terrain.description || 'Aucune description'}</p>
                  </div>
                </div>
                {canManage && <button
                  onClick={() => handleToggleActive(terrain)}
                  disabled={togglingId === terrain.id}
                  className="flex items-center gap-1 group/toggle shrink-0 focus:outline-none"
                  title={terrain.is_active ? 'Desactiver' : 'Activer'}
                >
                  {togglingId === terrain.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
                  ) : terrain.is_active ? (
                    <ToggleRight className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-emerald-400 group-hover/toggle:text-emerald-300 transition-colors duration-200" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 text-slate-500 group-hover/toggle:text-slate-400 transition-colors duration-200" />
                  )}
                </button>}
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`px-2 xs:px-2.5 py-1 text-[10px] xs:text-xs font-medium rounded-full ${
                    terrain.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}
                >
                  {terrain.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(terrain)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white px-3 min-h-[44px] rounded-xl transition-all duration-200 text-xs xs:text-sm font-medium border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <Edit2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                    <span className="hidden xs:inline">Modifier</span>
                    <span className="xs:hidden">Editer</span>
                  </button>
                  <IconPill
                    variant="danger"
                    onClick={() => setDeletingTerrain(terrain)}
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                  </IconPill>
                </div>
              )}
            </div>
          </CardShell>
        ))}
      </div>

      {/* Empty state */}
      {terrains.length === 0 && (
        <CardShell className="text-center">
          <div className="py-6">
            <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50 ring-1 ring-white/5">
              <MapPin className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-white font-medium">Aucun terrain disponible</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Ajoutez votre premier terrain</p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <Plus className="w-4 h-4" />
              Creer un terrain
            </button>
          </div>
        </CardShell>
      )}

      {showFormModal && (
        <TerrainFormModal
          terrain={editingTerrain}
          onClose={() => {
            setShowFormModal(false);
            setEditingTerrain(null);
          }}
          onSaved={handleFormSaved}
        />
      )}

      {deletingTerrain && (
        <DeleteTerrainModal
          terrain={deletingTerrain}
          onClose={() => setDeletingTerrain(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};
