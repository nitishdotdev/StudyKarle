import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";

import PublicLayout from "./components/layout/PublicLayout";
import AuthLayout from "./components/layout/AuthLayout";
import PageLoader from "./components/common/PageLoader";

// Route-level code splitting: each page is fetched lazily, so the initial
// bundle stays small and only the chunks actually needed are downloaded.
// The heavy PDF viewer (pdf.js) and admin tooling are pulled in only when
// the corresponding routes are visited.
const LandingPage = lazy(function () {
  return import("./pages/LandingPage");
});
const LoginPage = lazy(function () {
  return import("./pages/LoginPage");
});
const SignupPage = lazy(function () {
  return import("./pages/SignupPage");
});
const ForgotPasswordPage = lazy(function () {
  return import("./pages/ForgotPasswordPage");
});
const GoogleCompletePage = lazy(function () {
  return import("./pages/GoogleCompletePage");
});
const GoogleLinkPage = lazy(function () {
  return import("./pages/GoogleLinkPage");
});
const DashboardPage = lazy(function () {
  return import("./pages/DashboardPage");
});
const DriveBrowsePage = lazy(function () {
  return import("./pages/DriveBrowsePage");
});
const DriveFilePage = lazy(function () {
  return import("./pages/DriveFilePage");
});
const DriveSharePage = lazy(function () {
  return import("./pages/DriveSharePage");
});
const NotePreviewPage = lazy(function () {
  return import("./pages/NotePreviewPage");
});
const SearchPage = lazy(function () {
  return import("./pages/SearchPage");
});
const SavedNotesPage = lazy(function () {
  return import("./pages/SavedNotesPage");
});
const ProfilePage = lazy(function () {
  return import("./pages/ProfilePage");
});
const NotFoundPage = lazy(function () {
  return import("./pages/NotFoundPage");
});
const FeaturesPage = lazy(function () {
  return import("./pages/FeaturesPage");
});
const HowItWorksPage = lazy(function () {
  return import("./pages/HowItWorksPage");
});
const AboutPage = lazy(function () {
  return import("./pages/AboutPage");
});
const ContactPage = lazy(function () {
  return import("./pages/ContactPage");
});
const PrivacyPage = lazy(function () {
  return import("./pages/PrivacyPage");
});
const TermsPage = lazy(function () {
  return import("./pages/TermsPage");
});

const AdminOverviewPage = lazy(function () {
  return import("./pages/admin/AdminOverviewPage");
});
const AdminUploadPage = lazy(function () {
  return import("./pages/admin/AdminUploadPage");
});
const AdminNotesPage = lazy(function () {
  return import("./pages/admin/AdminNotesPage");
});
const AdminSubjectsPage = lazy(function () {
  return import("./pages/admin/AdminSubjectsPage");
});
const AdminUsersPage = lazy(function () {
  return import("./pages/admin/AdminUsersPage");
});
const AdminAnalyticsPage = lazy(function () {
  return import("./pages/admin/AdminAnalyticsPage");
});
const AdminViewHistoryPage = lazy(function () {
  return import("./pages/admin/AdminViewHistoryPage");
});

function SuspenseRoute({ children }) {
  return (
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<SuspenseRoute><LandingPage /></SuspenseRoute>} />
        <Route path="/features" element={<SuspenseRoute><FeaturesPage /></SuspenseRoute>} />
        <Route path="/how-it-works" element={<SuspenseRoute><HowItWorksPage /></SuspenseRoute>} />
        <Route path="/about" element={<SuspenseRoute><AboutPage /></SuspenseRoute>} />
        <Route path="/contact" element={<SuspenseRoute><ContactPage /></SuspenseRoute>} />
        <Route path="/privacy" element={<SuspenseRoute><PrivacyPage /></SuspenseRoute>} />
        <Route path="/terms" element={<SuspenseRoute><TermsPage /></SuspenseRoute>} />
        {/* Public, token-gated share links (separate from the authenticated file page) */}
        <Route path="/drive/share/:token" element={<SuspenseRoute><DriveSharePage /></SuspenseRoute>} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<SuspenseRoute><LoginPage /></SuspenseRoute>} />
        <Route path="/signup" element={<SuspenseRoute><SignupPage /></SuspenseRoute>} />
        <Route path="/forgot-password" element={<SuspenseRoute><ForgotPasswordPage /></SuspenseRoute>} />
        <Route path="/auth/google/complete" element={<SuspenseRoute><GoogleCompletePage /></SuspenseRoute>} />
        <Route path="/auth/google/link" element={<SuspenseRoute><GoogleLinkPage /></SuspenseRoute>} />
      </Route>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <SuspenseRoute><DashboardPage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drive"
        element={
          <ProtectedRoute>
            <SuspenseRoute><DriveBrowsePage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drive/folder/:nodeId"
        element={
          <ProtectedRoute>
            <SuspenseRoute><DriveBrowsePage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drive/file/:nodeId"
        element={
          <ProtectedRoute>
            <SuspenseRoute><DriveFilePage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notes/:noteId"
        element={
          <ProtectedRoute>
            <SuspenseRoute><NotePreviewPage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SuspenseRoute><SearchPage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/saved"
        element={
          <ProtectedRoute>
            <SuspenseRoute><SavedNotesPage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <SuspenseRoute><ProfilePage /></SuspenseRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminOverviewPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/upload"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminUploadPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/notes"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminNotesPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/subjects"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminSubjectsPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminUsersPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminAnalyticsPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/view-history"
        element={
          <AdminRoute>
            <SuspenseRoute><AdminViewHistoryPage /></SuspenseRoute>
          </AdminRoute>
        }
      />
      <Route path="*" element={<SuspenseRoute><NotFoundPage /></SuspenseRoute>} />
    </Routes>
  );
}
