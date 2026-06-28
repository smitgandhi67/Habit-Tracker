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
import Meals from './pages/Meals';
import MealsLibrary from './pages/MealsLibrary';
import MealsEditor from './pages/MealsEditor';
import MathPage from './pages/Math';
import MathAdmin from './pages/MathAdmin';
import Build from './pages/Build';
import Skills from './pages/Skills';
import SkillsBaselineParentQuiz from './pages/SkillsBaselineParentQuiz';
import SkillsBaselineKidQuiz from './pages/SkillsBaselineKidQuiz';
import SkillsBaselineResult from './pages/SkillsBaselineResult';
import Trophies from './pages/Trophies';
import JourneyAdmin from './pages/JourneyAdmin';
import PointsHistory from './pages/PointsHistory';
import Parenting from './pages/Parenting';
import ParentingQuiz from './pages/ParentingQuiz';
import ParentingResult from './pages/ParentingResult';
import ParentingHistory from './pages/ParentingHistory';
import ParentingKidQuiz from './pages/ParentingKidQuiz';
import ParentingGap from './pages/ParentingGap';
import ParentingAdmin from './pages/ParentingAdmin';
import ParentingAnswers from './pages/ParentingAnswers';

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
                  <Route path="/meals" element={<Meals />} />
                  <Route path="/meals/library" element={<MealsLibrary />} />
                  <Route path="/meals/:id/edit" element={<MealsEditor />} />
                  <Route path="/math" element={<MathPage />} />
                  <Route path="/build" element={<Build />} />
                  <Route path="/skills" element={<Skills />} />
                  <Route path="/skills/baseline/parent" element={<SkillsBaselineParentQuiz />} />
                  <Route path="/skills/baseline/kid" element={<SkillsBaselineKidQuiz />} />
                  <Route path="/skills/result/:id" element={<SkillsBaselineResult />} />
                  <Route path="/trophies" element={<Trophies />} />
                  <Route path="/journey/admin" element={<JourneyAdmin />} />
                  <Route path="/math/history" element={<PointsHistory />} />
                  <Route path="/math/admin" element={<MathAdmin />} />
                  <Route path="/parenting" element={<Parenting />} />
                  <Route path="/parenting/quiz/:key" element={<ParentingQuiz />} />
                  <Route path="/parenting/kid/:key" element={<ParentingKidQuiz />} />
                  <Route path="/parenting/result/:id" element={<ParentingResult />} />
                  <Route path="/parenting/history" element={<ParentingHistory />} />
                  <Route path="/parenting/gap" element={<ParentingGap />} />
                  <Route path="/parenting/admin" element={<ParentingAdmin />} />
                  <Route path="/parenting/answers/:id" element={<ParentingAnswers />} />
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
