import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SignupProvider } from './signup/SignupContext';
import RequireRole from './components/RequireRole';
import AppShell from './layouts/AppShell';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SignupBasics from './pages/signup/SignupBasics';
import SignupWorldId from './pages/signup/SignupWorldId';
import SignupProfile from './pages/signup/SignupProfile';
import SignupDocuments from './pages/signup/SignupDocuments';
import ApplicantMessages from './pages/applicant/ApplicantMessages';
import ApplicantJobs from './pages/applicant/ApplicantJobs';
import ApplicantApplications from './pages/applicant/ApplicantApplications';
import ApplicantProfile from './pages/applicant/ApplicantProfile';
import RecruiterJobs from './pages/recruiter/RecruiterJobs';
import RecruiterJobForm from './pages/recruiter/RecruiterJobForm';
import RecruiterJobDetail from './pages/recruiter/RecruiterJobDetail';
import RecruiterMessages from './pages/recruiter/RecruiterMessages';
import Negotiation from './pages/Negotiation';
import OfferNegotiation from './pages/OfferNegotiation';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 32, color: 'var(--text)' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SignupProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<SignupBasics />} />
            <Route path="/signup/world-id" element={<SignupWorldId />} />
            <Route path="/signup/profile" element={<SignupProfile />} />
            <Route path="/signup/documents" element={<SignupDocuments />} />

            <Route
              path="/applicant/messages"
              element={
                <RequireRole role="Applicant">
                  <AppShell>
                    <ApplicantMessages />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/applicant/jobs"
              element={
                <RequireRole role="Applicant">
                  <AppShell>
                    <ApplicantJobs />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/applicant/applications"
              element={
                <RequireRole role="Applicant">
                  <AppShell>
                    <ApplicantApplications />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/applicant/profile"
              element={
                <RequireRole role="Applicant">
                  <AppShell>
                    <ApplicantProfile />
                  </AppShell>
                </RequireRole>
              }
            />

            <Route
              path="/recruiter/jobs"
              element={
                <RequireRole role="Recruiter">
                  <AppShell>
                    <RecruiterJobs />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/recruiter/jobs/new"
              element={
                <RequireRole role="Recruiter">
                  <AppShell>
                    <RecruiterJobForm mode="create" />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/recruiter/jobs/:id"
              element={
                <RequireRole role="Recruiter">
                  <AppShell>
                    <RecruiterJobDetail />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/recruiter/jobs/:id/edit"
              element={
                <RequireRole role="Recruiter">
                  <AppShell>
                    <RecruiterJobForm mode="edit" />
                  </AppShell>
                </RequireRole>
              }
            />
            <Route
              path="/recruiter/messages"
              element={
                <RequireRole role="Recruiter">
                  <AppShell>
                    <RecruiterMessages />
                  </AppShell>
                </RequireRole>
              }
            />

            <Route
              path="/applications/:id"
              element={
                <RequireAuth>
                  <AppShell>
                    <Negotiation />
                  </AppShell>
                </RequireAuth>
              }
            />
            <Route
              path="/offers/:id"
              element={
                <RequireAuth>
                  <AppShell>
                    <OfferNegotiation />
                  </AppShell>
                </RequireAuth>
              }
            />
          </Routes>
        </SignupProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
