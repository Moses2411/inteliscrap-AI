import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/Layout/AppShell";
import { AppProvider } from "./store/AppProvider";
import ScanPage from "./pages/ScanPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <AppProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<ScanPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AppProvider>
  );
}
