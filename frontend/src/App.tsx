import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { AppProvider } from "./store/AppProvider";
import { getRole, getToken, syncRoleFromServer, type UserRole } from "./services/auth";
import LoginPage from "./pages/auth/LoginPage";
import LandingPage from "./pages/LandingPage";
import ApexArcPage from "./pages/ApexArcPage";
import MarketPage from "./pages/MarketPage";
import HomeDashboard from "./pages/dashboard/HomeDashboard";
import ScanPage from "./pages/ScanPage";
import HistoryPage from "./pages/HistoryPage";
import PickupsPage from "./pages/PickupsPage";
import MyPickupsPage from "./pages/MyPickupsPage";
import HubDashboard from "./pages/dashboard/HubDashboard";
import ImpactDashboard from "./pages/dashboard/ImpactDashboard";
import PartnerDashboard from "./pages/dashboard/PartnerDashboard";
import SalesReportDashboard from "./pages/dashboard/SalesReportDashboard";
import SettingsPage from "./pages/SettingsPage";

function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const location = useLocation();
  const role = getRole();
  if (!role) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardRoute() {
  const role = getRole();
  switch (role) {
    case "collector":
    case "household":
      return <HomeDashboard />;
    case "recycling_hub":
      return <HubDashboard />;
    case "ngo":
    case "admin":
      return <ImpactDashboard />;
    case "partner":
      return <PartnerDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function ShellRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="/pickups"
          element={
            <RequireRole roles={["collector"]}>
              <PickupsPage />
            </RequireRole>
          }
        />
        <Route
          path="/my-pickups"
          element={
            <RequireRole roles={["collector"]}>
              <MyPickupsPage />
            </RequireRole>
          }
        />
        <Route
          path="/hub"
          element={
            <RequireRole roles={["recycling_hub"]}>
              <HubDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/impact"
          element={
            <RequireRole roles={["ngo", "admin"]}>
              <ImpactDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/report"
          element={
            <RequireRole roles={["recycling_hub", "admin"]}>
              <SalesReportDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/compliance"
          element={
            <RequireRole roles={["partner", "admin"]}>
              <PartnerDashboard />
            </RequireRole>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const [, setRoleVersion] = useState(0);

  // Reconcile the cached role with the server on boot so route guards and
  // API calls never operate on a stale role (source of truth = backend).
  useEffect(() => {
    if (!getToken()) return;
    syncRoleFromServer().then(() => setRoleVersion((v) => v + 1));
  }, []);

  return (
    <AppProvider>
      <Routes>
        {/* Standalone screens — outside the app shell */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/apex-arc" element={<ApexArcPage />} />
        <Route path="/*" element={<ShellRoutes />} />
      </Routes>
    </AppProvider>
  );
}