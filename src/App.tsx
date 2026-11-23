/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { OfflineSyncProvider } from './hooks/useOfflineSync';
import { ThemeProvider } from './hooks/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { SuperAdminRoute } from './components/layout/SuperAdminRoute';
import { LoadingState } from './components/ui/States';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const SetupPage = lazy(() =>
  import('./pages/SetupPage').then((m) => ({ default: m.SetupPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const LegalDocumentPage = lazy(() =>
  import('./pages/legal/LegalDocumentPage').then((m) => ({ default: m.LegalDocumentPage }))
);
const ShareLandingPage = lazy(() =>
  import('./pages/ShareLandingPage').then((m) => ({ default: m.ShareLandingPage }))
);
const MinistriesPage = lazy(() =>
  import('./pages/MinistriesPage').then((m) => ({ default: m.MinistriesPage }))
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
const TestTakePage = lazy(() =>
  import('./pages/student/TestTakePage').then((m) => ({ default: m.TestTakePage }))
);
const TestResultDetailPage = lazy(() =>
  import('./pages/student/TestResultDetailPage').then((m) => ({ default: m.TestResultDetailPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/student/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const OfflineLibraryPage = lazy(() =>
  import('./pages/student/OfflineLibraryPage').then((m) => ({ default: m.OfflineLibraryPage }))
);
const MockExamsPage = lazy(() =>
  import('./pages/student/MockExamsPage').then((m) => ({ default: m.MockExamsPage }))
);
const MockTakePage = lazy(() =>
  import('./pages/student/MockTakePage').then((m) => ({ default: m.MockTakePage }))
);
const MockResultDetailPage = lazy(() =>
  import('./pages/student/MockResultDetailPage').then((m) => ({ default: m.MockResultDetailPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminStudentsPage = lazy(() =>
  import('./pages/admin/AdminStudentsPage').then((m) => ({ default: m.AdminStudentsPage }))
);
const AdminAnnouncementsPage = lazy(() =>
  import('./pages/admin/AdminAnnouncementsPage').then((m) => ({ default: m.AdminAnnouncementsPage }))
);
const AdminExamsPage = lazy(() =>
  import('./pages/admin/AdminExamsPage').then((m) => ({ default: m.AdminExamsPage }))
);
const AdminSubjectsPage = lazy(() =>
  import('./pages/admin/AdminSubjectsPage').then((m) => ({ default: m.AdminSubjectsPage }))
);
const AdminTopicsPage = lazy(() =>
  import('./pages/admin/AdminTopicsPage').then((m) => ({ default: m.AdminTopicsPage }))
);
const AdminLessonsPage = lazy(() =>
  import('./pages/admin/AdminLessonsPage').then((m) => ({ default: m.AdminLessonsPage }))
);
const AdminLessonEditorPage = lazy(() =>
  import('./pages/admin/AdminLessonEditorPage').then((m) => ({ default: m.AdminLessonEditorPage }))
);
const AdminTestsPage = lazy(() =>
  import('./pages/admin/AdminTestsPage').then((m) => ({ default: m.AdminTestsPage }))
);
const AdminTestEditorPage = lazy(() =>
  import('./pages/admin/AdminTestEditorPage').then((m) => ({ default: m.AdminTestEditorPage }))
);
const AdminTutorGuidePage = lazy(() =>
  import('./pages/admin/AdminTutorGuidePage').then((m) => ({ default: m.AdminTutorGuidePage }))
);
const AdminAccountsPage = lazy(() =>
  import('./pages/admin/AdminAccountsPage').then((m) => ({ default: m.AdminAccountsPage }))
);
const AdminQuestionBankPage = lazy(() =>
  import('./pages/admin/AdminQuestionBankPage').then((m) => ({ default: m.AdminQuestionBankPage }))
);
const AdminMockExamsPage = lazy(() =>
  import('./pages/admin/AdminMockExamsPage').then((m) => ({ default: m.AdminMockExamsPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

function PasswordRecoveryRedirect() {
  const { isPasswordRecovery } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPasswordRecovery && location.pathname !== '/reset-password') {
      navigate('/reset-password', { replace: true });
    }
  }, [isPasswordRecovery, location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <OfflineSyncProvider>
            <PasswordRecoveryRedirect />
            <AppShell>
              <Suspense fallback={<LoadingState message="Loading page..." />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/ministries" element={<MinistriesPage />} />
                  <Route path="/church" element={<MinistriesPage />} />
                  <Route path="/setup" element={<SetupPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/legal" element={<LegalDocumentPage />} />
                  <Route path="/legal/:docSlug" element={<LegalDocumentPage />} />
                  <Route path="/share" element={<ShareLandingPage />} />
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
                    <Route path="/app/tests/:testId" element={<TestTakePage />} />
                    <Route path="/app/results" element={<ResultsPage />} />
                    <Route path="/app/results/:attemptId" element={<TestResultDetailPage />} />
                    <Route path="/app/profile" element={<ProfilePage />} />
                    <Route path="/app/offline" element={<OfflineLibraryPage />} />
                    <Route path="/app/mocks" element={<MockExamsPage />} />
                    <Route path="/app/mocks/:attemptId" element={<MockTakePage />} />
                    <Route path="/app/mocks/results/:attemptId" element={<MockResultDetailPage />} />

                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminDashboardPage />} />
                    <Route path="/admin/students" element={<AdminStudentsPage />} />
                    <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
                    <Route path="/admin/examinations" element={<AdminExamsPage />} />
                    <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
                    <Route path="/admin/topics" element={<AdminTopicsPage />} />
                    <Route path="/admin/lessons" element={<AdminLessonsPage />} />
                    <Route path="/admin/lessons/:lessonId" element={<AdminLessonEditorPage />} />
                    <Route path="/admin/tests" element={<AdminTestsPage />} />
                    <Route path="/admin/tests/:testId" element={<AdminTestEditorPage />} />
                    <Route path="/admin/mocks" element={<AdminMockExamsPage />} />
                    <Route path="/admin/guide" element={<AdminTutorGuidePage />} />
                    <Route element={<SuperAdminRoute />}>
                      <Route path="/admin/accounts" element={<AdminAccountsPage />} />
                      <Route path="/admin/question-bank" element={<AdminQuestionBankPage />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AppShell>
          </OfflineSyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
