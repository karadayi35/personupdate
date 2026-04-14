import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  QrCode, 
  ShieldCheck, 
  Bell, 
  Save,
  RefreshCw,
  Info,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({
    radius: 100,
    qrRefreshInterval: 30,
    notifications: {
      checkIn: true,
      checkOut: true,
      late: true
    }
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: new Date().toISOString()
      });
      alert('Ayarlar başarıyla kaydedildi.');
    } catch (error) {
      console.error('Save settings error:', error);
      alert('Ayarlar kaydedilirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-whatsapp-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Sistem Ayarları</h1>
        <p className="text-slate-400">Giriş-çıkış yöntemlerini ve güvenlik ayarlarını yapılandırın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Geofencing Settings */}
        <div className="bg-[#111b21] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 text-whatsapp-500">
            <MapPin size={24} />
            <h3 className="text-lg font-bold text-white">Konum Kontrolü (Geofencing)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Varsayılan İzin Verilen Yarıçap (Metre)</label>
              <input 
                type="number"
                value={settings.radius}
                onChange={(e) => setSettings({ ...settings, radius: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info size={12} />
                Personel bu yarıçap dışındaysa giriş yapamaz.
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-whatsapp-500/5 rounded-xl border border-whatsapp-500/10">
              <ShieldCheck className="text-whatsapp-500" size={20} />
              <span className="text-sm text-slate-300">GPS Doğrulaması Aktif</span>
            </div>
          </div>
        </div>

        {/* QR Settings */}
        <div className="bg-[#111b21] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 text-purple-500">
            <QrCode size={24} />
            <h3 className="text-lg font-bold text-white">QR Kod Ayarları</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">QR Kod Yenileme Sıklığı (Saniye)</label>
              <input 
                type="number"
                value={settings.qrRefreshInterval}
                onChange={(e) => setSettings({ ...settings, qrRefreshInterval: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info size={12} />
                Dinamik QR kodun ne kadar sürede bir değişeceğini belirler.
              </p>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
              <p className="text-xs text-slate-400">
                Not: Şubeye özel statik QR kodları "Şube Yönetimi" sayfasından alıp çıktı alabilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* License Info */}
        <div className="bg-[#111b21] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 text-green-500">
            <ShieldCheck size={24} />
            <h3 className="text-lg font-bold text-white">Lisans Bilgileri</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-700">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Lisans Anahtarı</p>
              <p className="text-sm font-mono text-slate-200">PT-8822-XK99-LL21-0042</p>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Durum:</span>
              <span className="text-green-500 font-bold">AKTİF</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Bitiş Tarihi:</span>
              <span className="text-slate-200">Süresiz (Ömür Boyu)</span>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-[#111b21] p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3 text-amber-500">
            <Bell size={24} />
            <h3 className="text-lg font-bold text-white">Bildirim Ayarları</h3>
          </div>
          <div className="space-y-4">
            {[
              { id: 'checkIn', label: 'Giriş Bildirimleri', desc: 'Personel giriş yaptığında yöneticiye bildir.' },
              { id: 'checkOut', label: 'Çıkış Bildirimleri', desc: 'Personel çıkış yaptığında yöneticiye bildir.' },
              { id: 'late', label: 'Geç Kalma Uyarısı', desc: 'Vardiyaya geç kalanları anında bildir.' },
            ].map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={(settings.notifications as any)[item.id]}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        [item.id]: e.target.checked
                      }
                    })}
                  />
                  <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-whatsapp-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave}
          disabled={submitting}
          className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-whatsapp-600/20 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          <span>Ayarları Kaydet</span>
        </button>
      </div>
    </div>
  );
}
