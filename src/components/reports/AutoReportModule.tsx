import React from 'react';
import { 
  Mail, 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Settings,
  FileText,
  FileSpreadsheet,
  Users,
  Coffee,
  Layers,
  History,
  ToggleLeft,
  ToggleRight,
  PlusCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AutoReportConfig {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
  reports: string[];
  formats: ('pdf' | 'excel')[];
  isActive: boolean;
  lastSent?: any;
  createdAt: any;
}

interface AutoReportLog {
  id: string;
  configId: string;
  configName: string;
  status: 'success' | 'failed';
  recipients: string[];
  sentAt: any;
  error?: string;
}

const REPORT_OPTIONS = [
  { id: 'attendance', label: 'Personel Devam Raporu', icon: Users },
  { id: 'payroll', label: 'Puantaj Özeti', icon: FileSpreadsheet },
  { id: 'leave', label: 'İzin Raporu', icon: Calendar },
  { id: 'break', label: 'Mola Raporu', icon: Coffee },
  { id: 'shift', label: 'Vardiya Raporu', icon: Layers },
];

export default function AutoReportModule() {
  const [configs, setConfigs] = React.useState<AutoReportConfig[]>([]);
  const [logs, setLogs] = React.useState<AutoReportLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isTestLoading, setIsTestLoading] = React.useState<string | null>(null);
  const [editingConfig, setEditingConfig] = React.useState<AutoReportConfig | null>(null);

  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    recipients: [] as string[],
    reports: [] as string[],
    formats: ['pdf'] as ('pdf' | 'excel')[],
    isActive: true
  });
  const [newRecipient, setNewRecipient] = React.useState('');

  React.useEffect(() => {
    const unsubConfigs = onSnapshot(
      query(collection(db, 'auto_report_configs'), orderBy('createdAt', 'desc')),
      (snap) => {
        setConfigs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoReportConfig)));
        setLoading(false);
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'auto_report_logs'), orderBy('sentAt', 'desc')),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoReportLog)));
      }
    );

    return () => {
      unsubConfigs();
      unsubLogs();
    };
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.recipients.length === 0) {
      alert('En az bir alıcı eklemelisiniz.');
      return;
    }
    if (formData.reports.length === 0) {
      alert('En az bir rapor seçmelisiniz.');
      return;
    }

    try {
      if (editingConfig) {
        await updateDoc(doc(db, 'auto_report_configs', editingConfig.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'auto_report_configs'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Bu yapılandırmayı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'auto_report_configs', id));
    } catch (error) {
      console.error('Error deleting config:', error);
    }
  };

  const toggleActive = async (config: AutoReportConfig) => {
    try {
      await updateDoc(doc(db, 'auto_report_configs', config.id), {
        isActive: !config.isActive
      });
    } catch (error) {
      console.error('Error toggling active state:', error);
    }
  };

  const handleTestMail = async (config: AutoReportConfig) => {
    setIsTestLoading(config.id);
    try {
      // Simulate test mail sending
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Log the test attempt
      await addDoc(collection(db, 'auto_report_logs'), {
        configId: config.id,
        configName: config.name,
        status: 'success',
        recipients: config.recipients,
        sentAt: serverTimestamp(),
        isTest: true
      });

      alert('Test maili başarıyla gönderildi.');
    } catch (error) {
      console.error('Test mail error:', error);
      alert('Test maili gönderilirken bir hata oluştu.');
    } finally {
      setIsTestLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      frequency: 'daily',
      time: '09:00',
      recipients: [],
      reports: [],
      formats: ['pdf'],
      isActive: true
    });
    setEditingConfig(null);
    setNewRecipient('');
  };

  const addRecipient = () => {
    if (!newRecipient || !newRecipient.includes('@')) return;
    if (formData.recipients.includes(newRecipient)) return;
    setFormData({ ...formData, recipients: [...formData.recipients, newRecipient] });
    setNewRecipient('');
  };

  const removeRecipient = (email: string) => {
    setFormData({ ...formData, recipients: formData.recipients.filter(r => r !== email) });
  };

  const toggleReport = (reportId: string) => {
    const reports = formData.reports.includes(reportId)
      ? formData.reports.filter(r => r !== reportId)
      : [...formData.reports, reportId];
    setFormData({ ...formData, reports });
  };

  const toggleFormat = (format: 'pdf' | 'excel') => {
    const formats = formData.formats.includes(format)
      ? formData.formats.filter(f => f !== format)
      : [...formData.formats, format];
    setFormData({ ...formData, formats });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-whatsapp-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Otomatik Rapor Yollama</h2>
          <p className="text-sm text-slate-500">Raporlarınızı planlayın ve yöneticilere otomatik gönderin.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-700 text-white px-6 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-whatsapp-600/20"
        >
          <Plus size={18} />
          <span>Yeni Plan Oluştur</span>
        </button>
      </div>

      {/* Config List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {configs.length === 0 ? (
          <div className="lg:col-span-2 bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Mail size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Henüz bir plan oluşturulmamış</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">
              Otomatik rapor gönderimi için ilk planınızı oluşturun.
            </p>
          </div>
        ) : (
          configs.map(config => (
            <div key={config.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 relative overflow-hidden group">
              {!config.isActive && (
                <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <span className="bg-slate-200 text-slate-600 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Pasif</span>
                </div>
              )}
              
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    config.isActive ? "bg-whatsapp-50 text-whatsapp-600" : "bg-slate-100 text-slate-400"
                  )}>
                    <Mail size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{config.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <Clock size={12} />
                      <span className="capitalize">{config.frequency === 'daily' ? 'Günlük' : config.frequency === 'weekly' ? 'Haftalık' : 'Aylık'}</span>
                      <span>•</span>
                      <span>{config.time}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 relative z-20">
                  <button 
                    onClick={() => handleTestMail(config)}
                    disabled={isTestLoading === config.id}
                    className="p-2 hover:bg-whatsapp-50 text-whatsapp-600 rounded-xl transition-all"
                    title="Test Maili Gönder"
                  >
                    {isTestLoading === config.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                  <button 
                    onClick={() => { setEditingConfig(config); setFormData(config); setIsModalOpen(true); }}
                    className="p-2 hover:bg-whatsapp-50 text-whatsapp-600 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteConfig(config.id)}
                    className="p-2 hover:bg-whatsapp-50 text-whatsapp-600 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => toggleActive(config)}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      config.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {config.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Raporlar</p>
                  <div className="flex flex-wrap gap-1">
                    {config.reports.map(r => (
                      <span key={r} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                        {REPORT_OPTIONS.find(opt => opt.id === r)?.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Formatlar</p>
                  <div className="flex gap-2">
                    {config.formats.map(f => (
                      <div key={f} className="flex items-center gap-1 text-slate-600">
                        {f === 'pdf' ? <FileText size={14} className="text-whatsapp-500" /> : <FileSpreadsheet size={14} className="text-emerald-500" />}
                        <span className="text-[10px] font-bold uppercase">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {config.recipients.slice(0, 3).map((email, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600" title={email}>
                      {email[0].toUpperCase()}
                    </div>
                  ))}
                  {config.recipients.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">
                      +{config.recipients.length - 3}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Son Gönderim</p>
                  <p className="text-xs font-bold text-slate-600">
                    {config.lastSent ? format(config.lastSent.toDate(), 'dd MMM HH:mm', { locale: tr }) : 'Henüz gönderilmedi'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Logs Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <History size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Gönderim Geçmişi ve Loglar</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Adı</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zaman</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alıcılar</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Durum</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    Henüz bir gönderim kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">{log.configName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500 font-medium">
                        {format(log.sentAt.toDate(), 'dd.MM.yyyy HH:mm:ss', { locale: tr })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-600 font-bold">{log.recipients.length} Alıcı</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        log.status === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-whatsapp-50 text-whatsapp-600"
                      )}>
                        {log.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{log.status === 'success' ? 'Başarılı' : 'Hata'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.status === 'failed' && (
                        <div className="flex items-center justify-end gap-1 text-whatsapp-600" title={log.error}>
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-bold">Hata Logu</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-whatsapp-600 text-white flex items-center justify-center shadow-lg shadow-whatsapp-600/20">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{editingConfig ? 'Planı Düzenle' : 'Yeni Otomatik Rapor Planı'}</h3>
                  <p className="text-sm text-slate-500">Gönderim ayarlarını yapılandırın.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-slate-200 text-slate-400 flex items-center justify-center transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">Plan Adı</label>
                  <input 
                    type="text"
                    required
                    placeholder="Örn: Haftalık Yönetim Raporu"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">Gönderim Sıklığı</label>
                    <select 
                      value={formData.frequency}
                      onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all appearance-none"
                    >
                      <option value="daily">Günlük</option>
                      <option value="weekly">Haftalık</option>
                      <option value="monthly">Aylık</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 ml-1">Gönderim Saati</label>
                    <input 
                      type="time"
                      required
                      value={formData.time}
                      onChange={e => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 ml-1">Alıcı E-posta Adresleri</label>
                  <div className="flex gap-2">
                    <input 
                      type="email"
                      placeholder="yönetici@şirket.com"
                      value={newRecipient}
                      onChange={e => setNewRecipient(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 font-bold focus:ring-2 focus:ring-whatsapp-500 focus:bg-white outline-none transition-all"
                    />
                    <button 
                      type="button"
                      onClick={addRecipient}
                      className="bg-slate-800 text-white px-4 rounded-2xl font-bold hover:bg-slate-900 transition-all"
                    >
                      Ekle
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.recipients.map(email => (
                      <div key={email} className="flex items-center gap-2 bg-whatsapp-50 text-whatsapp-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-whatsapp-100 animate-in zoom-in duration-200">
                        <span>{email}</span>
                        <button type="button" onClick={() => removeRecipient(email)} className="hover:text-whatsapp-800">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 ml-1">Gönderilecek Raporlar</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {REPORT_OPTIONS.map(report => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => toggleReport(report.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left",
                          formData.reports.includes(report.id)
                            ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600 shadow-sm"
                            : "bg-white border-slate-200 text-slate-500 hover:border-whatsapp-200 hover:bg-whatsapp-50/30"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          formData.reports.includes(report.id) ? "bg-whatsapp-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          <report.icon size={16} />
                        </div>
                        <span className="text-xs font-bold">{report.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 ml-1">Dosya Formatları</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleFormat('pdf')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all",
                        formData.formats.includes('pdf')
                          ? "bg-whatsapp-50 border-whatsapp-200 text-whatsapp-600"
                          : "bg-white border-slate-200 text-slate-400"
                      )}
                    >
                      <FileText size={18} />
                      <span className="text-xs font-bold">PDF Belgesi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFormat('excel')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all",
                        formData.formats.includes('excel')
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-white border-slate-200 text-slate-400"
                      )}
                    >
                      <FileSpreadsheet size={18} />
                      <span className="text-xs font-bold">Excel Tablosu</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit"
                  className="flex-[2] bg-whatsapp-600 hover:bg-whatsapp-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-whatsapp-600/20"
                >
                  {editingConfig ? 'Değişiklikleri Kaydet' : 'Planı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
