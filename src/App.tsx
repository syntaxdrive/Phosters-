/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { LoadingState } from './components/ui/States';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const SetupPage = lazy(() =>
  import('./pages/SetupPage').then((m) => ({ default: m.SetupPage }))
);
const LoginPage = lazy(() =>
  import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = lazy(() =>
  import('./pages/auth/SignupPage').then((m) => ({ default: m.SignupPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const HomePage = lazy(() =>
  import('./pages/student/HomePage').then((m) => ({ default: m.HomePage }))
);
const ExamSetupPage = lazy(() =>
  import('./pages/student/ExamSetupPage').then((m) => ({ default: m.ExamSetupPage }))
);
const SubjectsPage = lazy(() =>
  import('./pages/student/SubjectsPage').then((m) => ({ default: m.SubjectsPage }))
);
const SubjectDetailPage = lazy(() =>
  import('./pages/student/SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage }))
);
const LessonPage = lazy(() =>
  import('./pages/student/LessonPage').then((m) => ({ default: m.LessonPage }))
);
const ResultsPage = lazy(() =>
  import('./pages/student/ResultsPage').then((m) => ({ default: m.ResultsPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/student/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Suspense fallback={<LoadingState message="Loading page..." />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<HomePage />} />
                <Route path="/app/setup-exams" element={<ExamSetupPage />} />
                <Route path="/app/subjects" element={<SubjectsPage />} />
                <Route path="/app/subjects/:examSlug/:subjectSlug" element={<SubjectDetailPage />} />
                <Route path="/app/lessons/:lessonId" element={<LessonPage />} />
                <Route path="/app/results" element={<ResultsPage />} />
                <Route path="/app/profile" element={<ProfilePage />} />

                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
}
