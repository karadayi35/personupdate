import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Users,
  Navigation,
  X,
  Loader2,
  Save,
  QrCode,
  Printer,
  Download
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';

interface Branch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: any;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: 41.0082,
    lng: 28.9784,
    radius: 100
  });

  useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const q = query(branchesRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const branchData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[];
      setBranches(branchData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });

    return () => unsubscribe();
  }, []);

  const handleMapsLinkPaste = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    if (!url) return;

    // Try to find @lat,lng (standard browser URL)
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    // Try to find q=lat,lng or ll=lat,lng (query params)
    const queryRegex = /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    
    const match = url.match(atRegex) || url.match(queryRegex);

    if (match && match[1] && match[2]) {
      setFormData(prev => ({
        ...prev,
        lat: Number(match[1]),
        lng: Number(match[2])
      }));
      // Clear the input after successful parse to show it worked
      e.target.value = '';
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'branches', editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'branches'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        address: '',
        lat: 41.0082,
        lng: 28.9784,
        radius: 100
      });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'branches');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      address: branch.address,
      lat: branch.lat,
      lng: branch.lng,
      radius: branch.radius
    });
    setIsModalOpen(true);
  };

  const handleDeleteBranch = async (id: string) => {
    if (!window.confirm('Bu konumu silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `branches/${id}`);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector('.qr-container svg') as SVGElement;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_${selectedBranch?.name || 'branch'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Konum Yönetimi</h1>
          <p className="text-slate-500">İşletmenize ait şubeleri ve giriş yapılabilecek alanları tanımlayın.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', address: '', lat: 41.0082, lng: 28.9784, radius: 100 });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={20} />
          <span>Yeni Konum Ekle</span>
        </button>
      </div>

      {/* Konum Kontrolü Bilgi Kartı */}
      <div className="bg-whatsapp-50 border border-whatsapp-100 p-6 rounded-2xl flex items-start gap-4">
        <div className="p-3 bg-white rounded-xl text-whatsapp-600 shadow-sm">
          <Navigation size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-whatsapp-900">Konum Kontrolü Aktif</h3>
          <p className="text-whatsapp-700 text-sm mt-1 leading-relaxed">
            Personelleriniz sadece aşağıda tanımlanan konumların <strong>belirlenen yarıçapı</strong> içerisinde giriş-çıkış yapabilirler. 
            Alan dışı giriş denemeleri sistem tarafından otomatik olarak işaretlenir veya engellenir.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
          <Loader2 className="animate-spin text-whatsapp-600" size={32} />
          <p className="font-medium">Konumlar yükleniyor...</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="p-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin size={40} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Henüz Konum Eklenmemiş</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Personellerin giriş yapabilmesi için en az bir şube veya çalışma alanı konumu eklemelisiniz.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-8 text-whatsapp-600 font-bold hover:underline"
          >
            İlk konumu şimdi ekle →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden group hover:border-whatsapp-200 hover:shadow-xl hover:shadow-whatsapp-600/5 transition-all duration-500 flex flex-col">
              <div className="h-40 bg-slate-50 relative overflow-hidden">
                {/* Mock Map Background */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:20px_20px]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-whatsapp-600/10 rounded-full animate-ping" style={{ width: '100px', height: '100px', margin: '-40px' }} />
                    <div className="w-10 h-10 bg-whatsapp-600 rounded-full flex items-center justify-center text-white shadow-lg relative z-10">
                      <MapPin size={20} />
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedBranch(branch);
                      setIsQRModalOpen(true);
                    }}
                    title="QR Kodunu Görüntüle"
                    className="p-2.5 bg-white/90 backdrop-blur hover:bg-white rounded-xl text-purple-600 shadow-sm transition-all hover:scale-110"
                  >
                    <QrCode size={16} />
                  </button>
                  <button 
                    onClick={() => handleEdit(branch)}
                    className="p-2.5 bg-white/90 backdrop-blur hover:bg-white rounded-xl text-slate-600 shadow-sm transition-all hover:scale-110"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="p-2.5 bg-whatsapp-500 hover:bg-whatsapp-600 rounded-xl text-white shadow-sm transition-all hover:scale-110"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-bold text-whatsapp-600 uppercase tracking-wider shadow-sm">
                    {branch.radius}m Yarıçap
                  </span>
                </div>
              </div>
              
              <div className="p-6 space-y-4 flex-1 flex flex-col">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-whatsapp-600 transition-colors">{branch.name}</h3>
                  <p className="text-sm text-slate-500 flex items-start gap-2 mt-2">
                    <MapPin size={16} className="shrink-0 text-slate-400" />
                    {branch.address}
                  </p>
                </div>

                <div className="pt-4 mt-auto border-t border-slate-50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-400 font-medium">KOORDİNATLAR</p>
                      <p className="font-mono text-slate-600">{branch.lat.toFixed(4)}, {branch.lng.toFixed(4)}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-slate-400 font-medium">DURUM</p>
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Aktif
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      {isQRModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:rounded-none">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Şube QR Kodu</h2>
                <p className="text-sm text-slate-500 mt-1">{selectedBranch.name}</p>
              </div>
              <button 
                onClick={() => setIsQRModalOpen(false)}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-10 flex flex-col items-center space-y-8 print-content">
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 print:shadow-none print:border-none qr-container">
                <QRCodeSVG 
                  value={selectedBranch.id} 
                  size={240} 
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-800">{selectedBranch.name}</h3>
                <p className="text-sm text-slate-500 max-w-[280px]">
                  Personeller bu kodu okutarak giriş-çıkış yapabilirler.
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full print:hidden">
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold transition-all"
                  >
                    <Printer size={20} />
                    <span>Yazdır</span>
                  </button>
                  <button 
                    onClick={handleDownloadQR}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold transition-all"
                  >
                    <Download size={20} />
                    <span>İndir (PNG)</span>
                  </button>
                </div>
                <button 
                  onClick={() => setIsQRModalOpen(false)}
                  className="w-full bg-whatsapp-600 hover:bg-whatsapp-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-whatsapp-600/20"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Konumu Düzenle' : 'Yeni Konum Ekle'}</h2>
                <p className="text-sm text-slate-500 mt-1">Lütfen konum bilgilerini eksiksiz giriniz.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddBranch} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Google Maps Linki (Otomatik Koordinat)</label>
                <input 
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  placeholder="https://www.google.com/maps/@..."
                  onChange={handleMapsLinkPaste}
                />
                <p className="text-[10px] text-slate-400 ml-1 italic">Link yapıştırdığınızda enlem ve boylam otomatik güncellenir.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Konum Adı</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  placeholder="Örn: Merkez Ofis veya Şube 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Açık Adres</label>
                <textarea 
                  required
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all resize-none"
                  placeholder="Şubenin tam adresi..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Enlem (Lat)</label>
                  <input 
                    type="number"
                    step="any"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Boylam (Lng)</label>
                  <input 
                    type="number"
                    step="any"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-5 text-slate-800 focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">İzin Verilen Yarıçap (Metre)</label>
                  <span className="text-whatsapp-600 font-bold text-sm">{formData.radius}m</span>
                </div>
                <input 
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-whatsapp-600"
                  value={formData.radius}
                  onChange={(e) => setFormData({ ...formData, radius: Number(e.target.value) })}
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                  <span>10m</span>
                  <span>500m</span>
                  <span>1000m</span>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  <span>{editingId ? 'Güncelle' : 'Konumu Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
