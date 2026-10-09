import type { FC, SVGProps } from "react";
import {
  BarChart3,
  Camera,
  History,
  LayoutDashboard,
  LayoutPanelTop,
  PieChart,
  Receipt,
  Settings,
  Store,
  Truck,
} from "lucide-react";
import type { UserRole } from "../services/auth";

export type Icon = FC<SVGProps<SVGSVGElement>>;

export interface NavItem {
  path: string;
  labelKey: string;
  icon: Icon;
}

/** Full navigation for a role (used by the desktop sidebar). */
export function getNavForRole(role: UserRole | null): NavItem[] {
  const items: NavItem[] = [
    { path: "/dashboard", labelKey: "nav_dashboard", icon: LayoutDashboard },
    { path: "/market", labelKey: "nav_market", icon: Store },
  ];

  if (role === "household") items.push({ path: "/history", labelKey: "nav_history", icon: History });
  if (role === "collector") {
    items.push(
      { path: "/pickups", labelKey: "nav_offers", icon: LayoutPanelTop },
      { path: "/my-pickups", labelKey: "nav_jobs", icon: Truck },
    );
  }
  if (role === "recycling_hub") {
    items.push({ path: "/hub", labelKey: "nav_hub", icon: PieChart });
    items.push({ path: "/report", labelKey: "nav_report", icon: BarChart3 });
    items.push({ path: "/compliance", labelKey: "nav_compliance", icon: Receipt });
  }
  if (role === "ngo" || role === "admin") {
    items.push({ path: "/impact", labelKey: "nav_impact", icon: PieChart });
  }
  if (role === "admin") {
    items.push({ path: "/report", labelKey: "nav_report", icon: BarChart3 });
  }
  if (role === "partner" || role === "admin") {
    items.push({ path: "/compliance", labelKey: "nav_compliance", icon: Receipt });
  }

  items.push({ path: "/scan", labelKey: "nav_scan", icon: Camera });
  items.push({ path: "/settings", labelKey: "nav_settings", icon: Settings });
  return items;
}

export interface PrimaryNavItem {
  path: string;
  labelKey: string;
  icon: Icon;
}

/** The key role page surfaced as the 4th bottom-nav tab. */
export function getPrimaryRolePage(role: UserRole | null): PrimaryNavItem | null {
  switch (role) {
    case "household":
      return { path: "/history", labelKey: "nav_history", icon: History };
    case "collector":
      return { path: "/my-pickups", labelKey: "nav_jobs", icon: Truck };
    case "recycling_hub":
      return { path: "/hub", labelKey: "nav_hub", icon: PieChart };
    case "ngo":
    case "admin":
      return { path: "/impact", labelKey: "nav_impact", icon: PieChart };
    case "partner":
      return { path: "/compliance", labelKey: "nav_compliance", icon: Receipt };
    default:
      return null;
  }
}