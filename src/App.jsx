import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { UsermavenProvider } from '@usermaven/react';
import { AuthProvider } from './context/AuthContext';
import { usermavenClient } from './lib/usermaven';
import { HabitsContext, useHabits } from './hooks/useHabits';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Today from './pages/Today';
import Habits from './pages/Habits';
import Reports from './pages/Reports';
import Gym from './pages/Gym';
import Coaching from './pages/Coaching';
import Sleep from './pages/Sleep';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function AppInner() {
  const store = useHabits();
  return (
    <HabitsContext.Provider value={store}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/today" replace />} />
                  <Route path="/today" element={<Today />} />
                  <Route path="/habits" element={<Habits />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/gym" element={<Gym />} />
                  <Route path="/gym/coaching" element={<Coaching />} />
                  <Route path="/sleep" element={<Sleep />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HabitsContext.Provider>
  );
}

export default function App() {
  const tree = (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
        <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
      </BrowserRouter>
    </AuthProvider>
  );

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {usermavenClient
        ? <UsermavenProvider client={usermavenClient}>{tree}</UsermavenProvider>
        : tree}
    </GoogleOAuthProvider>
  );
}
