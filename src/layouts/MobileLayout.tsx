import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Home, 
  Clock, 
  Calendar, 
  Bell, 
  User, 
  Menu, 
  X, 
  LogOut, 
  Settings, 
  FileText, 
  HelpCircle, 
  Star,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { onSnapshot, doc, query, collection, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function MobileLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch employee data to show in sidebar
    const q = query(collection(db, 'employees'), where('authUid', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setUserData(snapshot.docs[0].data());
      }
    });

    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { icon: Home, label: 'Anasayfa', path: '/mobile' },
    { icon: Clock, label: 'Kayıtlarım', path: '/mobile/records' },
    { icon: Calendar, label: 'Vardiya', path: '/mobile/schedule' },
    { icon: Bell, label: 'Duyurular', path: '/mobile/announcements' },
    { icon: User, label: 'Hesabım', path: '/mobile/profile' },
  ];

  const menuItems = [
    { icon: Home, label: 'Anasayfa', path: '/mobile', color: 'text-whatsapp-600' },
    { icon: Clock, label: 'Kayıtlarım', path: '/mobile/records' },
    { icon: Calendar, label: 'Vardiya', path: '/mobile/schedule' },
    { icon: Bell, label: 'Duyurular', path: '/mobile/announcements' },
    { icon: User, label: 'Hesabım', path: '/mobile/profile' },
  ];

  const otherItems = [
    { icon: Calendar, label: 'İzin Taleplerim', path: '/mobile/leaves' },
    { icon: Settings, label: 'Ayarlar', path: '/mobile/settings' },
    { icon: HelpCircle, label: 'Kullanım Kılavuzu', path: '/mobile/guide' },
    { icon: Star, label: 'Uygulamayı Değerlendir', path: '/mobile/rate' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <Menu size={24} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
          {navItems.find(item => item.path === location.pathname)?.label || 'PERSONEL MOBİL'}
        </h1>
        <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors relative">
          <Bell size={24} className="text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-2 flex items-center justify-around z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                isActive ? "text-whatsapp-600" : "text-slate-400"
              )}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px] font-bold", isActive ? "opacity-100" : "opacity-70")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white z-50 shadow-2xl flex flex-col"
            >
              {/* Sidebar Header */}
              <div className="p-6 border-b border-slate-50 flex items-start justify-between">
                <div className="flex flex-col gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-whatsapp-50 flex items-center justify-center text-whatsapp-600 text-2xl font-bold border border-whatsapp-100">
                    {userData?.name?.charAt(0) || 'N'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{userData?.name || 'Necati candan'}</h2>
                    <span className="text-xs font-bold text-whatsapp-600 uppercase tracking-widest">PERSONEL</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-6 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MENÜ</span>
                </div>
                <div className="space-y-1 px-3">
                  {menuItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-2xl transition-colors",
                        location.pathname === item.path ? "bg-whatsapp-50 text-whatsapp-600" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <item.icon size={22} />
                      <span className="font-bold">{item.label}</span>
                    </Link>
                  ))}
                </div>

                <div className="px-6 mt-8 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DİĞER</span>
                </div>
                <div className="space-y-1 px-3">
                  {otherItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <item.icon size={22} />
                      <span className="font-bold">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-6 border-t border-slate-50">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-colors"
                >
                  <LogOut size={20} />
                  <span>Oturumu Kapat</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
