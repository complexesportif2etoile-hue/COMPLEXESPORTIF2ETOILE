import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, UserPlus } from 'lucide-react';

function FootballIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="96" fill="url(#ballGrad)" stroke="url(#rimGrad)" strokeWidth="3" />
      <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="0.5" opacity="0.15" />
      <polygon points="100,45 118,58 112,80 88,80 82,58" fill="#1e293b" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <polygon points="58,100 65,80 85,75 92,92 78,108" fill="#1e293b" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <polygon points="142,100 135,80 115,75 108,92 122,108" fill="#1e293b" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <polygon points="78,140 88,122 100,118 112,122 122,140 110,152 90,152" fill="#1e293b" stroke="white" strokeWidth="1.5" opacity="0.9" />
      <line x1="100" y1="45" x2="100" y2="28" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="82" y1="58" x2="65" y2="48" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="118" y1="58" x2="135" y2="48" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="65" y1="80" x2="48" y2="72" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="58" y1="100" x2="38" y2="100" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="78" y1="108" x2="65" y2="120" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="135" y1="80" x2="152" y2="72" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="142" y1="100" x2="162" y2="100" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="122" y1="108" x2="135" y2="120" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="88" y1="122" x2="82" y2="132" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="112" y1="122" x2="118" y2="132" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="90" y1="152" x2="85" y2="168" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <line x1="110" y1="152" x2="115" y2="168" stroke="white" strokeWidth="1.5" opacity="0.5" />
      <ellipse cx="72" cy="62" rx="18" ry="10" fill="white" opacity="0.12" transform="rotate(-30 72 62)" />
      <defs>
        <radialGradient id="ballGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="40%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </radialGradient>
        <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'receptionist'>('receptionist');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl scale-110 animate-pulse" />
            <FootballIcon className="w-28 h-28 sm:w-32 sm:h-32 drop-shadow-2xl relative" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">COMPLEXE SPORTIF 2e ETOILE</h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">
            {isSignUp ? 'Créer votre compte' : 'Connectez-vous pour continuer'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/60 shadow-xl shadow-black/20 p-6 sm:p-8">
          {/* Gradient accent line */}
          <div className="h-1 w-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-6 mx-auto" />

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nom complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                  placeholder="Votre nom"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                placeholder="votre@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                placeholder="Mot de passe"
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rôle</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                >
                  <option value="receptionist">Réceptionniste</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignUp ? 'Créer le Compte' : 'Se Connecter'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg px-3 py-1"
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
