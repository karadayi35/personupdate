import React from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  Building2,
  Calendar,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { 
  Key,
  AlertTriangle
} from 'lucide-react';

interface Employee {
  id: string;
  authUid?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  branchId: string;
  branchName?: string;
  avatar?: string;
  status: 'active' | 'inactive';
  employeeCode: string;
  mobileAccessActive: boolean;
  mobileAccountCreated: boolean;
  tempPassword?: string;
  createdAt: any;
}

interface Branch {
  id: string;
  name: string;
}

export default function Employees() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState('all');
  const [selectedStatus, setSelectedStatus] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    branchId: '',
    employeeCode: '',
    status: 'active' as const,
    mobileAccessActive: true
  });

  const [generatedPassword, setGeneratedPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    setShowPassword(true);
  };

  React.useEffect(() => {
    const branchesRef = collection(db, 'branches');
    const unsubscribeBranches = onSnapshot(branchesRef, (snapshot) => {
      const branchData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[];
      setBranches(branchData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches');
    });

    const employeesRef = collection(db, 'employees');
    const q = query(employeesRef, orderBy('createdAt', 'desc'));
    const unsubscribeEmployees = onSnapshot(q, (snapshot) => {
      const employeeData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(employeeData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });

    return () => {
      unsubscribeBranches();
      unsubscribeEmployees();
    };
  }, []);

  const sendRealEmail = async (email: string, name: string, tempPassword: string) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: 'Personel Takip Sistemi - Mobil Giriş Bilgileriniz',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #e11d48;">Hoş Geldiniz, ${name}</h2>
              <p>Mobil uygulama giriş bilgileriniz aşağıda yer almaktadır:</p>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">E-posta Adresiniz</p>
                <p style="margin: 5px 0 15px 0; font-weight: bold; font-size: 16px;">${email}</p>
                <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Geçici Şifreniz</p>
                <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px; color: #e11d48;">${tempPassword}</p>
              </div>
              <p style="color: #64748b; font-size: 14px;"><strong>Önemli:</strong> Güvenliğiniz için ilk girişten sonra şifrenizi değiştirmenizi öneririz.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Bu e-posta otomatik olarak gönderilmiştir, lütfen yanıtlamayınız.</p>
            </div>
          `
        })
      });
      return response.ok;
    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let currentPassword = generatedPassword;
    if (!currentPassword && formData.mobileAccessActive) {
      // Auto-generate password if not generated yet
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let password = "";
      for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      currentPassword = password;
      setGeneratedPassword(password);
    }

    setSubmitting(true);
    try {
      let authUid = '';
      
      // 1. Create Firebase Auth user via backend if mobile access is active
      if (formData.mobileAccessActive) {
        try {
          const authResponse = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: currentPassword,
              displayName: formData.name
            })
          });
          
          let authData;
          const responseText = await authResponse.text();
          try {
            authData = JSON.parse(responseText);
          } catch (e) {
            console.error('Failed to parse auth response as JSON:', responseText);
            throw new Error('Sunucudan geçersiz yanıt alındı. Lütfen sistem yöneticisine başvurun.');
          }

          if (authResponse.ok) {
            authUid = authData.uid;
          } else {
            console.error('Auth creation failed:', authData.error);
            // If user already exists, we might want to link it, but for now just warn
            if (authData.error?.includes('email address is already in use')) {
              throw new Error('Bu e-posta adresi ile zaten bir kullanıcı mevcut. Lütfen farklı bir e-posta kullanın.');
            }
            throw new Error('Mobil hesap oluşturulamadı: ' + (authData.error || 'Bilinmeyen hata'));
          }
        } catch (e: any) {
          console.error('Auth API call error:', e);
          throw new Error(e.message || 'Sunucu bağlantı hatası nedeniyle mobil hesap oluşturulamadı.');
        }
      }

      // 2. Create employee document in Firestore
      const docRef = await addDoc(collection(db, 'employees'), {
        ...formData,
        authUid,
        tempPassword: currentPassword,
        mobileAccountCreated: !!authUid,
        createdAt: serverTimestamp()
      });

      // 3. Send real email via backend
      const emailSent = await sendRealEmail(formData.email, formData.name, currentPassword);

      // 4. Log the result
      await addDoc(collection(db, 'email_logs'), {
        employeeId: docRef.id,
        employeeEmail: formData.email,
        type: 'welcome_mobile',
        status: emailSent ? 'success' : 'failed',
        sentAt: serverTimestamp(),
        content: {
          name: formData.name,
          tempPassword: generatedPassword,
          message: emailSent ? 'E-posta başarıyla gönderildi.' : 'E-posta gönderimi başarısız oldu.'
        },
        error: emailSent ? null : 'Backend email service error'
      });

      setIsModalOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: '',
        department: '',
        branchId: '',
        employeeCode: '',
        status: 'active',
        mobileAccessActive: true
      });
      setGeneratedPassword('');
      setShowPassword(false);
      
      if (emailSent) {
        alert('Personel başarıyla eklendi ve giriş bilgileri e-posta ile gönderildi.');
      } else {
        alert('Personel eklendi ancak e-posta gönderilemedi. Lütfen RESEND_API_KEY ayarlarını kontrol edin.');
      }
    } catch (error) {
      console.error('Add employee error:', error);
      alert(error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setSubmitting(true);
    try {
      // 1. Update Auth status if changed
      if (editingEmployee.authUid) {
        const response = await fetch('/api/update-user-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: editingEmployee.authUid,
            disabled: formData.status === 'inactive'
          })
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('Update user status failed:', text);
        }
      }

      // 2. Update Firestore
      const docRef = doc(db, 'employees', editingEmployee.id);
      await updateDoc(docRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setIsEditModalOpen(false);
      setEditingEmployee(null);
      alert('Personel bilgileri güncellendi.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setSubmitting(true);
    try {
      // 1. Delete Auth user via backend
      if (deletingEmployee.authUid) {
        const response = await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: deletingEmployee.authUid })
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('Delete user failed:', text);
        }
      }

      // 2. Delete Firestore document
      const docRef = doc(db, 'employees', deletingEmployee.id);
      await deleteDoc(docRef);
      setIsDeleteModalOpen(false);
      setDeletingEmployee(null);
      alert('Personel silindi ve mobil erişimi iptal edildi.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employees');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let newPassword = "";
    for (let i = 0; i < 10; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (!confirm(`${emp.name} için şifre sıfırlansın mı? Yeni şifre e-posta ile gönderilecektir.`)) return;

    try {
      // 1. Revoke Auth tokens if exists
      if (emp.authUid) {
        const response = await fetch('/api/update-user-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: emp.authUid,
            disabled: emp.status === 'inactive'
          })
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('Reset password status update failed:', text);
        }
      }

      // 2. Update Firestore
      const docRef = doc(db, 'employees', emp.id);
      await updateDoc(docRef, {
        tempPassword: newPassword,
        updatedAt: serverTimestamp()
      });

      const emailSent = await sendRealEmail(emp.email, emp.name, newPassword);

      await addDoc(collection(db, 'email_logs'), {
        employeeId: emp.id,
        employeeEmail: emp.email,
        type: 'password_reset',
        status: emailSent ? 'success' : 'failed',
        sentAt: serverTimestamp(),
        content: {
          name: emp.name,
          tempPassword: newPassword,
          message: emailSent ? 'Yeni şifre başarıyla gönderildi.' : 'Yeni şifre gönderimi başarısız oldu.'
        }
      });

      if (emailSent) {
        alert('Şifre sıfırlandı ve yeni giriş bilgileri e-posta ile gönderildi.');
      } else {
        alert('Şifre güncellendi ancak e-posta gönderilemedi.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    }
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department,
      branchId: emp.branchId,
      employeeCode: emp.employeeCode,
      status: emp.status,
      mobileAccessActive: emp.mobileAccessActive
    });
    setIsEditModalOpen(true);
  };

  const handleCreateMobileAccount = async (emp: Employee) => {
    setSubmitting(true);
    try {
      // 1. Create Firebase Auth user via backend
      const authResponse = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emp.email,
          password: emp.tempPassword || '12345678', // Fallback if missing
          displayName: emp.name
        })
      });
      
      let authData;
      const responseText = await authResponse.text();
      try {
        authData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse auth response as JSON:', responseText);
        throw new Error('Sunucudan geçersiz yanıt alındı.');
      }

      if (!authResponse.ok) {
        throw new Error(authData.error || 'Auth hesabı oluşturulamadı.');
      }

      // 2. Update Firestore
      const docRef = doc(db, 'employees', emp.id);
      await updateDoc(docRef, {
        authUid: authData.uid,
        mobileAccountCreated: true,
        updatedAt: serverTimestamp()
      });

      // 3. Send email
      await sendRealEmail(emp.email, emp.name, emp.tempPassword || '12345678');

      alert('Mobil hesap başarıyla oluşturuldu ve bilgiler e-posta ile gönderildi.');
    } catch (error) {
      console.error('Retry auth creation error:', error);
      alert(error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Şifre kopyalandı!');
  };

  const resendEmail = async (emp: Employee) => {
    try {
      const emailSent = await sendRealEmail(emp.email, emp.name, emp.tempPassword || '');
      
      await addDoc(collection(db, 'email_logs'), {
        employeeId: emp.id,
        employeeEmail: emp.email,
        type: 'welcome_mobile_retry',
        status: emailSent ? 'success' : 'failed',
        sentAt: serverTimestamp(),
        content: {
          name: emp.name,
          tempPassword: emp.tempPassword,
          message: emailSent ? 'E-posta başarıyla tekrar gönderildi.' : 'E-posta tekrar gönderimi başarısız oldu.'
        }
      });

      if (emailSent) {
        alert('E-posta başarıyla tekrar gönderildi.');
      } else {
        alert('E-posta gönderilemedi. Lütfen RESEND_API_KEY ayarlarını kontrol edin.');
      }
    } catch (error) {
      console.error('Email error:', error);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBranch = selectedBranch === 'all' || emp.branchId === selectedBranch;
    const matchesStatus = selectedStatus === 'all' || emp.status === selectedStatus;

    return matchesSearch && matchesBranch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Personel Yönetimi</h1>
          <p className="text-slate-400">Tüm personellerinizi buradan yönetebilirsiniz.</p>
        </div>
        <button 
          onClick={() => {
            if (branches.length === 0) {
              alert('Lütfen önce "Şube Yönetimi" kısmından en az bir şube ekleyin.');
              return;
            }
            setFormData({
              name: '',
              email: '',
              phone: '',
              role: '',
              department: '',
              branchId: '',
              employeeCode: '',
              status: 'active',
              mobileAccessActive: true
            });
            setGeneratedPassword('');
            setShowPassword(false);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-whatsapp-600 hover:bg-whatsapp-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-whatsapp-600/20"
        >
          <UserPlus size={20} />
          <span>Yeni Personel Ekle</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-[#111b21] p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text"
            placeholder="İsim, e-posta veya personel kodu ile ara..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Tüm Şubeler</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select 
            className="bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111b21] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
              <Loader2 className="animate-spin text-whatsapp-500" size={32} />
              <p>Personeller yükleniyor...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p>Personel bulunamadı.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Sicil No</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Personel</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">İletişim</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Departman / Rol</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400">Durum</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-400 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-whatsapp-500 font-bold">{emp.employeeCode || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {emp.avatar ? (
                          <img 
                            src={emp.avatar} 
                            alt={emp.name} 
                            className="w-10 h-10 rounded-full object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-whatsapp-500 font-bold border border-slate-700">
                            {emp.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-white">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Mail size={12} />
                          <span>{emp.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Phone size={12} />
                          <span>{emp.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-slate-200">{emp.role}</p>
                        <p className="text-xs text-slate-500">{emp.department}</p>
                        <p className="text-[10px] text-slate-600">
                          {branches.find(b => b.id === emp.branchId)?.name || 'Bilinmeyen Şube'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          emp.status === 'active' ? "bg-green-500/10 text-green-500" : "bg-whatsapp-500/10 text-whatsapp-500"
                        )}>
                          {emp.status === 'active' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {emp.status === 'active' ? 'Aktif' : 'Pasif'}
                        </span>
                        {emp.mobileAccessActive && (
                          <div className="flex items-center gap-1 text-[10px] text-whatsapp-400 font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-whatsapp-500 animate-pulse" />
                            Mobil Aktif
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar size={14} />
                        <span>{emp.createdAt?.toDate ? emp.createdAt.toDate().toLocaleDateString('tr-TR') : '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!emp.mobileAccountCreated && emp.mobileAccessActive && (
                          <button 
                            onClick={() => handleCreateMobileAccount(emp)}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-whatsapp-400 transition-colors"
                            title="Mobil Hesap Oluştur (Hata Sonrası Tekrar Dene)"
                          >
                            <UserPlus size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleResetPassword(emp)}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
                          title="Şifre Sıfırla"
                        >
                          <Key size={16} />
                        </button>
                        {emp.tempPassword && (
                          <button 
                            onClick={() => resendEmail(emp)}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                            title="E-posta Tekrar Gönder"
                          >
                            <Mail size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => openEditModal(emp)}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-whatsapp-500 transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setDeletingEmployee(emp);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-whatsapp-500 transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111b21] w-full max-w-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Personel Düzenle</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Ad Soyad</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">E-posta</label>
                  <input 
                    type="email"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="ahmet@firma.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Telefon</label>
                  <input 
                    type="tel"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="0555 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Personel Kodu</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="P001"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Departman</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: İnsan Kaynakları"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Rol / Ünvan</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: Yazılım Geliştirici"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Şube</label>
                  <select 
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Şube Seçin</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Durum</label>
                  <select 
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-whatsapp-500/10 text-whatsapp-500 flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-200">Mobil Giriş Yetkisi</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={formData.mobileAccessActive}
                    onChange={(e) => setFormData({ ...formData, mobileAccessActive: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-600"></div>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Edit2 size={20} />}
                  <span>Güncelle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111b21] w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-whatsapp-500/10 text-whatsapp-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Personeli Sil</h2>
                <p className="text-slate-400 mt-2">
                  <span className="font-bold text-slate-200">{deletingEmployee?.name}</span> isimli personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  İptal
                </button>
                <button 
                  onClick={handleDeleteEmployee}
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                  <span>Sil</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111b21] w-full max-w-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Yeni Personel Ekle</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Ad Soyad</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">E-posta</label>
                  <input 
                    type="email"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="ahmet@firma.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Telefon</label>
                  <input 
                    type="tel"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="0555 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Personel Kodu</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="P001"
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Departman</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: İnsan Kaynakları"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Rol / Ünvan</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    placeholder="Örn: Yazılım Geliştirici"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Şube</label>
                  <select 
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Şube Seçin</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Durum</label>
                  <select 
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 focus:ring-2 focus:ring-whatsapp-500 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-whatsapp-500/10 text-whatsapp-500 flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-200">Mobil Giriş Ayarları</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.mobileAccessActive}
                      onChange={(e) => setFormData({ ...formData, mobileAccessActive: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-600"></div>
                  </label>
                </div>

                {formData.mobileAccessActive && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-slate-200 font-mono text-sm flex items-center justify-between">
                        <span>{generatedPassword || 'Şifre oluşturulmadı'}</span>
                        {generatedPassword && (
                          <button 
                            type="button"
                            onClick={() => copyToClipboard(generatedPassword)}
                            className="text-whatsapp-500 hover:text-whatsapp-400 font-bold text-xs"
                          >
                            Kopyala
                          </button>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={generatePassword}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl font-bold text-xs transition-all"
                      >
                        Şifre Üret
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      * Yeni personel eklendiğinde bu şifre otomatik olarak e-posta ile gönderilecektir.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-whatsapp-600 hover:bg-whatsapp-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-whatsapp-600/20 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  <span>Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
