import { useEffect, useState } from 'react';
import { MapPin, Phone, Clock, Star, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Terrain } from '../../types';

export function ComplexeSportif2eEtoilePage() {
  const [terrains, setTerrains] = useState<Terrain[]>([]);

  useEffect(() => {
    supabase.from('terrains').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setTerrains(data);
    });
  }, []);

  const handleBook = () => {
    window.location.href = '/reserver';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-slate-950" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
            <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Complexe Sportif<br />
            <span className="text-emerald-400">2ème Étoile</span>
          </h1>
          <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
            Votre complexe sportif de référence. Terrains de qualité, disponibles 7j/7.
          </p>
          <button
            onClick={handleBook}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3.5 rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-emerald-500/20"
          >
            <Calendar className="w-5 h-5" />
            Réserver un terrain
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Nos terrains</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {terrains.map((t) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all">
              <div className="h-32 bg-gradient-to-br from-emerald-900/30 to-slate-800 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-emerald-400/60" />
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-white mb-1">{t.name}</h3>
                {t.description && <p className="text-xs text-slate-400 mb-3">{t.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">{new Intl.NumberFormat('fr-FR').format(t.tarif_horaire)} FCFA/h</span>
                  <button onClick={handleBook} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
                    Réserver <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {terrains.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-500">
              Chargement des terrains...
            </div>
          )}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <Clock className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <h3 className="font-semibold text-white mb-1">Ouvert 7j/7</h3>
            <p className="text-sm text-slate-400">06h00 – 00h00</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <MapPin className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="font-semibold text-white mb-1">Localisation</h3>
            <p className="text-sm text-slate-400">Dakar, Sénégal</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <Phone className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="font-semibold text-white mb-1">Contact</h3>
            <p className="text-sm text-slate-400">Réservez en ligne</p>
          </div>
        </div>
      </section>

      <footer className="text-center py-8 text-slate-600 text-sm border-t border-slate-800">
        <p>Complexe Sportif 2ème Étoile — Tous droits réservés</p>
      </footer>
    </div>
  );
}
