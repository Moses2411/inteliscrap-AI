import { getRole } from "../../services/auth";
import HouseholdDashboard from "./HouseholdDashboard";
import CollectorDashboard from "./CollectorDashboard";

/** Role-aware landing dashboard for sellers and collectors. */
export default function HomeDashboard() {
  const role = getRole();
  if (role === "collector") return <CollectorDashboard />;
  return <HouseholdDashboard />;
}