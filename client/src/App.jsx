import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import PageTracker from "./components/PageTracker";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import MoneyTransactions from "./pages/MoneyTransactions";
import MoneyReceipts from "./pages/MoneyReceipts";
import MoneyTaxPack from "./pages/MoneyTaxPack";
import Groups from "./pages/Groups";
import GroupInvitations from "./pages/GroupInvitations";
import GroupDetail from "./pages/GroupDetail";
import GroupSummary from "./pages/GroupSummary";
import Profile from "./pages/Profile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsPage from "./pages/TermsPage";
import WhatWeStore from "./pages/WhatWeStore";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Router>
          <PageTracker />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/what-we-store" element={<WhatWeStore />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/money/transactions"
              element={
                <ProtectedRoute>
                  <MoneyTransactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/money/receipts"
              element={
                <ProtectedRoute>
                  <MoneyReceipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/money/tax-pack"
              element={
                <ProtectedRoute>
                  <MoneyTaxPack />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <Groups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-invitations"
              element={
                <ProtectedRoute>
                  <GroupInvitations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:groupId/summary"
              element={
                <ProtectedRoute>
                  <GroupSummary />
                </ProtectedRoute>
              }
            />
            <Route
              path="/groups/:groupId"
              element={
                <ProtectedRoute>
                  <GroupDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
