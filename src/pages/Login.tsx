import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-whatsapp-600 rounded-2xl shadow-xl shadow-whatsapp-600/20 mb-4">
            <Clock className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">PersoTrack</h1>
          <p className="text-slate-400">Sisteme Giriş Yapın</p>
        </div>

        <div className="bg-[#111b21] p-8 rounded-3xl border border-slate-800 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-whatsapp-500/10 border border-whatsapp-500/20 rounded-2xl flex items-center gap-3 text-whatsapp-500 text-sm">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1">E-posta Adresi</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  placeholder="admin@firma.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 ml-1">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-whatsapp-600 focus:ring-whatsapp-500" />
                <span>Beni Hatırla</span>
              </label>
              <button type="button" className="text-whatsapp-500 hover:text-whatsapp-400 font-medium">Şifremi Unuttum</button>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-whatsapp-600 hover:bg-whatsapp-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={20} />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm">
          Lisanslı Yazılım © 2024 PersoTrack
        </p>
      </div>
    </div>
  );
}
