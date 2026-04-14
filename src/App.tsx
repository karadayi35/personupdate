import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import AdminLayout from './layouts/AdminLayout';
import MobileLayout from './layouts/MobileLayout';

import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Settings from './pages/Settings';
import Branches from './pages/Branches';
import ShiftManagement from './pages/ShiftManagement';
import ShiftPlan from './pages/ShiftPlan';
import Login from './pages/Login';

import LeavesList from './pages/LeavesList';
import LeavesAdd from './pages/LeavesAdd';
import LeavesTotals from './pages/LeavesTotals';
import LeaveRequests from './pages/LeaveRequests';
import LeaveRightsAdd from './pages/LeaveRightsAdd';
import LeaveRightsList from './pages/LeaveRightsList';
import LeaveLogs from './pages/LeaveLogs';
import HourlyLeaveAdd from './pages/HourlyLeaveAdd';
import HourlyLeaveList from './pages/HourlyLeaveList';
import HourlyLeaveLogs from './pages/HourlyLeaveLogs';
import BreakManagement from './pages/BreakManagement';
import Reports from './pages/Reports';

// Employee Mobile Pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeSchedule from './pages/employee/EmployeeSchedule';
import EmployeeRecords from './pages/employee/EmployeeRecords';
import EmployeeProfile from './pages/employee/EmployeeProfile';
import EmployeeLeaves from './pages/employee/EmployeeLeaves';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const unsubData = onSnapshot(doc(db, 'users', user.uid), 
          (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data());
            }
            setLoading(false);
          },
          (error) => {
            console.error("User data fetch error:", error);
            setLoading(false); // Stop loading even on error
          }
        );
        
        // Safety timeout: if data doesn't load in 5 seconds, stop loading
        const timeout = setTimeout(() => setLoading(false), 5000);
        
        return () => {
          unsubData();
          clearTimeout(timeout);
        };
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-whatsapp-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">Sistem yükleniyor...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userData?.role === 'admin' || user?.email === 'aalikirmizigul89@gmail.com';

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/" element={user ? (isAdmin ? <AdminLayout /> : <Navigate to="/mobile" replace />) : <Navigate to="/login" replace />}>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance">
            <Route index element={<Navigate to="logs" replace />} />
            <Route path="logs" element={<Attendance />} />
            <Route path="reports" element={<Attendance />} />
          </Route>
          <Route path="leaves">
            <Route index element={<Navigate to="list" replace />} />
            <Route path="add" element={<LeavesAdd />} />
            <Route path="list" element={<LeavesList />} />
            <Route path="totals" element={<LeavesTotals />} />
            <Route path="requests" element={<LeaveRequests />} />
            <Route path="rights">
              <Route path="add" element={<LeaveRightsAdd />} />
              <Route path="list" element={<LeaveRightsList />} />
            </Route>
            <Route path="logs" element={<LeaveLogs />} />
            <Route path="hourly">
              <Route path="add" element={<HourlyLeaveAdd />} />
              <Route path="list" element={<HourlyLeaveList />} />
              <Route path="totals" element={<LeavesTotals />} />
              <Route path="requests" element={<LeaveRequests />} />
              <Route path="logs" element={<HourlyLeaveLogs />} />
            </Route>
          </Route>
          <Route path="locations" element={<Branches />} />
          <Route path="shifts">
            <Route index element={<Navigate to="plan" replace />} />
            <Route path="plan" element={<ShiftPlan />} />
            <Route path="automation" element={<ShiftManagement />} />
          </Route>
          <Route path="settings" element={<Settings />} />
          <Route path="breaks" element={<BreakManagement />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        {/* Mobile Employee Routes */}
        <Route path="/mobile" element={user ? <MobileLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<EmployeeDashboard />} />
          <Route path="records" element={<EmployeeRecords />} />
          <Route path="schedule" element={<EmployeeSchedule />} />
          <Route path="profile" element={<EmployeeProfile />} />
          <Route path="announcements" element={<div className="p-8 text-center text-slate-400 italic">Duyurular yakında burada olacak.</div>} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="settings" element={<div className="p-8 text-center text-slate-400 italic">Ayarlar yakında burada olacak.</div>} />
          <Route path="guide" element={<div className="p-8 text-center text-slate-400 italic">Kullanım kılavuzu yakında burada olacak.</div>} />
          <Route path="rate" element={<div className="p-8 text-center text-slate-400 italic">Değerlendirme yakında burada olacak.</div>} />
        </Route>

        <Route path="/login" element={!user ? <Login /> : (isAdmin ? <Navigate to="/" replace /> : <Navigate to="/mobile" replace />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
