import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Star,
  Users, 
  ArrowLeftRight,
  MapPin, 
  Clock,
  Calendar,
  Coffee,
  BarChart3,
  Tag,
  Settings, 
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const navItems = [
  { icon: Star, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Ekip Yönetimi', path: '/employees' },
  { icon: ArrowLeftRight, label: 'Giriş - Çıkış İşlemleri', path: '/attendance', hasSubmenu: true,
    submenu: [
      { label: 'Giriş-Çıkış İşlemleri', path: '/attendance/logs' },
      { label: 'Giriş-Çıkış Raporları', path: '/reports?type=attendance' },
    ]
  },
  { icon: MapPin, label: 'Konumlar', path: '/locations' },
  { icon: Clock, label: 'Çalışma Saatleri', path: '/work-hours' },
  { 
    icon: Calendar, 
    label: 'Vardiya', 
    path: '/shifts',
    hasSubmenu: true,
    submenu: [
      { label: 'Vardiya Planı', path: '/shifts/plan' },
      { label: 'Değişiklik Otomasyonu', path: '/shifts/automation' },
    ]
  },
  { 
    icon: Calendar, 
    label: 'İzin Yönetimi', 
    path: '/leaves',
    hasSubmenu: true,
    submenu: [
      { label: 'Yıllık İzinler', isHeader: true },
      { label: 'İzin Ekle', path: '/leaves/add' },
      { label: 'İzinleri Listele', path: '/leaves/list' },
      { label: 'İzin Toplamları', path: '/leaves/totals' },
      { label: 'İzin Talepleri', path: '/leaves/requests' },
      { label: 'İzin Hakkı Ekle', path: '/leaves/rights/add' },
      { label: 'İzin Haklarını Listele', path: '/leaves/rights/list' },
      { label: 'İzin Değişiklik Kayıtları', path: '/leaves/logs' },
      { label: 'Saatlik İzinler', isHeader: true },
      { label: 'Saatlik İzin Ekle', path: '/leaves/hourly/add' },
      { label: 'Saatlik İzinleri Listele', path: '/leaves/hourly/list' },
      { label: 'Saatlik İzin Toplamları', path: '/leaves/hourly/totals' },
      { label: 'Saatlik İzin Talepleri', path: '/leaves/hourly/requests' },
      { label: 'Saatlik İzin Değişiklik Kayıtları', path: '/leaves/hourly/logs' },
    ]
  },
  { icon: Coffee, label: 'Mola Kontrolü', path: '/breaks', hasSubmenu: true,
    submenu: [
      { label: 'Mola Kayıt ve Takip', path: '/breaks?tab=tracking' },
      { label: 'Mola Raporlama Sistemi', path: '/breaks?tab=reporting' },
    ]
  },
  { icon: BarChart3, label: 'Analiz & Raporlar', path: '/reports', hasSubmenu: true,
    submenu: [
      { label: 'Özet Dashboard', path: '/reports?type=dashboard' },
      { label: 'Personel Devam Raporu', path: '/reports?type=attendance' },
      { label: 'Puantaj Raporu', path: '/reports?type=payroll' },
      { label: 'İzin Raporu', path: '/reports?type=leave' },
      { label: 'Mola Raporu', path: '/reports?type=break' },
      { label: 'Vardiya Raporu', path: '/reports?type=shift' },
      { label: 'Şube / Departman Raporu', path: '/reports?type=branch' },
      { label: 'Giriş-Çıkış Detay Raporu', path: '/reports?type=entry-exit' },
    ]
  },
  { icon: Settings, label: 'Şirket Ayarları', path: '/settings' },
  { icon: HelpCircle, label: 'Yardım Merkezi', path: '/guide' },
  { icon: MapPin, label: 'Mobil Görünüm', path: '/mobile' },
];

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['İzin Yönetimi', 'Giriş - Çıkış İşlemleri', 'Vardiya']);
  const [user, setUser] = React.useState<any>(null);
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) 
        ? prev.filter(m => m !== label) 
        : [...prev, label]
    );
  };

  const isAdmin = user?.email === 'aalikirmizigul89@gmail.com';

  const filteredNavItems = navItems.filter(item => {
    if (isAdmin) return true;
    // Non-admins only see Overview and Attendance
    return ['Dashboard', 'Giriş - Çıkış İşlemleri'].includes(item.label);
  });

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-whatsapp-600/20 border-t-whatsapp-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 transform lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full lg:w-20"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <div className={cn("flex items-center gap-2", !isSidebarOpen && "lg:hidden")}>
              <div className="w-10 h-10 bg-whatsapp-600 rounded-xl flex items-center justify-center shadow-lg shadow-whatsapp-600/20">
                <div className="w-6 h-6 border-4 border-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
              <span className="font-bold text-2xl text-slate-800 tracking-tight">Patron</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg lg:block hidden text-slate-400"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 py-2 overflow-y-auto custom-scrollbar">
            {filteredNavItems.map((item) => (
              <div key={item.path} className="space-y-1">
                <div
                  onClick={() => item.hasSubmenu && toggleMenu(item.label)}
                  className="cursor-pointer"
                >
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => cn(
                      "flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 group",
                      isActive 
                        ? "bg-whatsapp-50 text-whatsapp-600 font-bold" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={cn("shrink-0", !isSidebarOpen && "mx-auto")} />
                      <span className={cn("text-sm", !isSidebarOpen && "lg:hidden")}>{item.label}</span>
                    </div>
                    {item.hasSubmenu && isSidebarOpen && (
                      <ChevronDown 
                        size={14} 
                        className={cn(
                          "text-slate-300 group-hover:text-slate-400 transition-transform duration-200",
                          expandedMenus.includes(item.label) && "rotate-180"
                        )} 
                      />
                    )}
                  </NavLink>
                </div>
                
                {item.hasSubmenu && item.submenu && isSidebarOpen && expandedMenus.includes(item.label) && (
                  <div className="pl-11 space-y-1">
                    {item.submenu.map((subItem) => (
                      subItem.isHeader ? (
                        <div key={subItem.label} className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {subItem.label}
                        </div>
                      ) : (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path!}
                          className={({ isActive }) => {
                            const isTabActive = subItem.path?.includes('?') 
                              ? location.pathname + location.search === subItem.path
                              : isActive;
                            
                            return cn(
                              "block px-4 py-2 text-sm rounded-lg transition-all duration-200",
                              isTabActive
                                ? "text-whatsapp-600 font-bold bg-whatsapp-50/50"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            );
                          }}
                        >
                          {subItem.label}
                        </NavLink>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="p-4 mt-auto">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-whatsapp-500 hover:bg-whatsapp-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-500/20"
            >
              <LogOut size={18} className={cn("shrink-0", !isSidebarOpen && "mx-auto")} />
              <span className={cn("text-sm", !isSidebarOpen && "lg:hidden")}>Çıkış yap</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg lg:hidden mr-4"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-800">Merhaba {user?.displayName || user?.email?.split('@')[0]},</h2>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{isAdmin ? 'Yönetici' : 'Personel'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center overflow-hidden">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
