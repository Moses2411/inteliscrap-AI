import type { MaterialCategoryInfo } from "../types";
import type { PickupJob, PickupOffer } from "../services/pickups";
import type { MarketplaceListing } from "../services/market";
import type { HubDelivery, HubInfo, HubRequest, HubSubscription } from "../services/hubs";
import type { ImpactByMaterial, ImpactDailyPoint, ImpactSummary } from "../services/impact";
import type { ComplianceManifesto, ManifestoItem } from "../services/compliance";

/** Toggleable preview data so the UI can be demoed fully offline. */
export function previewEnabled(): boolean {
  const v = localStorage.getItem("is_preview");
  if (v != null) return v === "1";
  return import.meta.env.DEV;
}

export function setPreviewEnabled(on: boolean): void {
  localStorage.setItem("is_preview", on ? "1" : "0");
}

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

// ── Materials / price guide ─────────────────────────────────────────
export const DEMO_MATERIALS: MaterialCategoryInfo[] = [
  { id: 1, slug: "copper", name: "Copper", price_per_kg_naira: 3850, is_hazardous: false },
  { id: 2, slug: "aluminum", name: "Aluminum", price_per_kg_naira: 950, is_hazardous: false },
  { id: 3, slug: "lead-acid-battery", name: "Lead-Acid Battery", price_per_kg_naira: 620, is_hazardous: true },
  { id: 4, slug: "brass", name: "Brass", price_per_kg_naira: 1750, is_hazardous: false },
  { id: 5, slug: "steel", name: "Steel", price_per_kg_naira: 210, is_hazardous: false },
  { id: 6, slug: "stainless-steel", name: "Stainless Steel", price_per_kg_naira: 540, is_hazardous: false },
  { id: 7, slug: "pet-plastic", name: "PET Plastic", price_per_kg_naira: 205, is_hazardous: false },
  { id: 8, slug: "e-waste", name: "E-Waste Board", price_per_kg_naira: 480, is_hazardous: true },
  { id: 9, slug: "glass", name: "Glass", price_per_kg_naira: 55, is_hazardous: false },
];

// ── Marketplace ─────────────────────────────────────────────────────
export const DEMO_LISTINGS: MarketplaceListing[] = [
  {
    id: "lst_demo_1",
    seller_id: "me",
    material_category_id: 3,
    title: "12V car batteries (4 pcs)",
    estimated_weight_kg: 72,
    estimated_value_naira: 44640,
    confidence_score: 0.93,
    toxicity_hazards: ["corrosive_acid", "lead_poisoning"],
    address_text: "Samaru, Zaria",
    latitude: 11.169,
    longitude: 7.633,
    status: "matched",
    created_at: daysAgo(0, 9),
  },
  {
    id: "lst_demo_2",
    seller_id: "u_other",
    material_category_id: 1,
    title: "Scrap copper wire, ~28 kg",
    estimated_weight_kg: 28,
    estimated_value_naira: 107800,
    confidence_score: 0.97,
    address_text: "Sabon Gari, Zaria",
    latitude: 11.099,
    longitude: 7.721,
    status: "open",
    created_at: daysAgo(0, 8),
  },
  {
    id: "lst_demo_3",
    seller_id: "u_other",
    material_category_id: 8,
    title: "Old computer boards & phones",
    estimated_weight_kg: 15,
    estimated_value_naira: 7200,
    confidence_score: 0.81,
    toxicity_hazards: ["pcb_contamination"],
    address_text: "Kongo, Zaria",
    latitude: 11.124,
    longitude: 7.701,
    status: "open",
    created_at: daysAgo(1, 14),
  },
  {
    id: "lst_demo_4",
    seller_id: "me",
    material_category_id: 2,
    title: "Aluminum pots & pans",
    estimated_weight_kg: 11,
    estimated_value_naira: 10450,
    confidence_score: 0.9,
    address_text: "Bomo, Zaria",
    latitude: 11.141,
    longitude: 7.576,
    status: "scheduled",
    created_at: daysAgo(2, 11),
  },
  {
    id: "lst_demo_5",
    seller_id: "u_other",
    material_category_id: 5,
    title: "Old galvanized roofing sheets",
    estimated_weight_kg: 64,
    estimated_value_naira: 13440,
    confidence_score: 0.88,
    address_text: "Hanwa, Zaria",
    latitude: 11.088,
    longitude: 7.65,
    status: "open",
    created_at: daysAgo(2, 16),
  },
];

// ── Collector ───────────────────────────────────────────────────────
export const DEMO_OFFERS: PickupOffer[] = [
  {
    pickup_id: "pk_demo_1",
    listing_id: "lst_demo_2",
    material_name: "Copper",
    material_slug: "copper",
    estimated_weight_kg: 28,
    estimated_value_naira: 107800,
    toxicity_hazards: [],
    address_text: "Sabon Gari, Zaria",
    distance_m: 640,
    created_at: daysAgo(0, 8),
  },
  {
    pickup_id: "pk_demo_2",
    listing_id: "lst_demo_3",
    material_name: "E-Waste Board",
    material_slug: "e-waste",
    estimated_weight_kg: 15,
    estimated_value_naira: 7200,
    toxicity_hazards: ["pcb_contamination"],
    address_text: "Kongo, Zaria",
    distance_m: 2100,
    created_at: daysAgo(1, 14),
  },
  {
    pickup_id: "pk_demo_3",
    listing_id: "lst_demo_5",
    material_name: "Steel",
    material_slug: "steel",
    estimated_weight_kg: 64,
    estimated_value_naira: 13440,
    toxicity_hazards: [],
    address_text: "Hanwa, Zaria",
    distance_m: 3400,
    created_at: daysAgo(2, 16),
  },
];

export const DEMO_JOBS: PickupJob[] = [
  {
    pickup_id: "pk_demo_4",
    listing_id: "lst_demo_4",
    material_name: "Aluminum",
    material_slug: "aluminum",
    estimated_weight_kg: 11,
    estimated_value_naira: 10450,
    address_text: "Bomo, Zaria",
    distance_m: 1200,
    status: "scheduled",
    contact_phone: "+2348031234567",
    latitude: 11.141,
    longitude: 7.576,
    accepted_at: daysAgo(2, 11),
  },
  {
    pickup_id: "pk_demo_5",
    listing_id: "lst_demo_1",
    material_name: "Lead-Acid Battery",
    material_slug: "lead-acid-battery",
    estimated_weight_kg: 72,
    estimated_value_naira: 44640,
    toxicity_hazards: ["corrosive_acid", "lead_poisoning"],
    address_text: "Samaru, Zaria",
    distance_m: 900,
    status: "accepted",
    contact_phone: "+2347049876543",
    latitude: 11.169,
    longitude: 7.633,
    accepted_at: daysAgo(0, 9),
  },
];

export const DEMO_COLLECTOR_INCOME = [8200, 9100, 8600, 12400, 11200, 15600, 17900, 16800, 22100]; // 9 weeks
export const DEMO_COLLECTOR_JOBS_DONE = 42;

// ── Hub ─────────────────────────────────────────────────────────────
export const DEMO_HUB: HubInfo = {
  id: "hub_demo",
  owner_user_id: "me",
  name: "Zaria Green Reclaim Centre",
  address_text: "Along Kano Road, Samaru, Zaria",
  city: "Zaria",
  contact_phone: "+2348055550101",
  is_active: true,
  created_at: daysAgo(120),
};

export const DEMO_HUB_REQUESTS: HubRequest[] = [
  {
    id: "req_demo_1",
    hub_id: "hub_demo",
    hub_name: "Zaria Green Reclaim Centre",
    material_category_id: 3,
    material_name: "Lead-Acid Battery",
    requested_kg: 500,
    fulfilled_kg: 322,
    note: "Dry batteries only — no cracked cases",
    requested_on: daysAgo(0).slice(0, 10),
    status: "open",
    created_at: daysAgo(0, 7),
  },
  {
    id: "req_demo_2",
    hub_id: "hub_demo",
    hub_name: "Zaria Green Reclaim Centre",
    material_category_id: 1,
    material_name: "Copper",
    requested_kg: 180,
    fulfilled_kg: 180,
    requested_on: daysAgo(0).slice(0, 10),
    status: "filled",
    created_at: daysAgo(0, 7),
  },
  {
    id: "req_demo_3",
    hub_id: "hub_demo",
    hub_name: "Zaria Green Reclaim Centre",
    material_category_id: 8,
    material_name: "E-Waste Board",
    requested_kg: 240,
    fulfilled_kg: 96,
    note: "Certified ICT asset disposal batch",
    requested_on: daysAgo(1).slice(0, 10),
    status: "open",
    created_at: daysAgo(1, 7),
  },
  {
    id: "req_demo_4",
    hub_id: "hub_demo",
    hub_name: "Zaria Green Reclaim Centre",
    material_category_id: 2,
    material_name: "Aluminum",
    requested_kg: 300,
    fulfilled_kg: 300,
    requested_on: daysAgo(2).slice(0, 10),
    status: "filled",
    created_at: daysAgo(2, 7),
  },
];

export const DEMO_HUB_DELIVERIES: HubDelivery[] = [
  { id: "del_1", hub_id: "hub_demo", request_id: "req_demo_2", transaction_id: "txn_1042", material_category_id: 1, weight_kg: 84, hub_price_naira: 323400, delivered_at: daysAgo(0, 13), created_at: daysAgo(0, 14) },
  { id: "del_2", hub_id: "hub_demo", request_id: "req_demo_1", transaction_id: "txn_1039", material_category_id: 3, weight_kg: 122, hub_price_naira: 75640, delivered_at: daysAgo(1, 12), created_at: daysAgo(1, 13) },
  { id: "del_3", hub_id: "hub_demo", request_id: "req_demo_2", transaction_id: "txn_1031", material_category_id: 1, weight_kg: 96, hub_price_naira: 369600, delivered_at: daysAgo(2, 11), created_at: daysAgo(2, 12) },
  { id: "del_4", hub_id: "hub_demo", request_id: "req_demo_1", transaction_id: "txn_1027", material_category_id: 3, weight_kg: 200, hub_price_naira: 124000, delivered_at: daysAgo(3, 10), created_at: daysAgo(3, 11) },
];

export const DEMO_HUB_SUBSCRIPTIONS: HubSubscription[] = [
  { id: "sub_1", hub_id: "hub_demo", plan_name: "Pro", amount_naira: 25000, cycle: "monthly", started_at: daysAgo(30), next_billing_at: daysAgo(-1, 9), status: "active", created_at: daysAgo(30, 9) },
  { id: "sub_2", hub_id: "hub_demo", plan_name: "Pro", amount_naira: 25000, cycle: "monthly", started_at: daysAgo(60), next_billing_at: daysAgo(-30, 9), status: "paid", created_at: daysAgo(60, 9) },
];

// ── Impact (NGO / admin) ────────────────────────────────────────────
export const DEMO_IMPACT_SUMMARY: ImpactSummary = {
  total_tonnage_kg: 128400,
  total_carbon_offset_kg_co2e: 34120,
  total_collector_income_naira: 4880500,
  transactions_count: 1247,
};

export const DEMO_IMPACT_DAILY: ImpactDailyPoint[] = (() => {
  const base: Array<[string, number]> = [
    ["Sep 06", 2160], ["Sep 07", 2480], ["Sep 08", 2290], ["Sep 09", 2970],
    ["Sep 10", 2640], ["Sep 11", 3050], ["Sep 12", 2810], ["Sep 13", 3420],
    ["Sep 14", 3180], ["Sep 15", 3710], ["Sep 16", 3540], ["Sep 17", 3980],
    ["Sep 18", 3760], ["Sep 19", 4250],
  ];
  return base.map(([period, tonnage]) => ({
    period,
    tonnage_kg: tonnage,
    carbon_offset_kg_co2e: Math.round(tonnage * 0.266),
    collector_income_naira: Math.round(tonnage * 38),
  }));
})();

export const DEMO_IMPACT_BY_MATERIAL: ImpactByMaterial[] = [
  { material: "Copper", tonnage_kg: 34200, carbon_offset_kg_co2e: 11980 },
  { material: "Aluminum", tonnage_kg: 28100, carbon_offset_kg_co2e: 9120 },
  { material: "Lead-Acid Battery", tonnage_kg: 20600, carbon_offset_kg_co2e: 4670 },
  { material: "E-Waste", tonnage_kg: 15300, carbon_offset_kg_co2e: 4390 },
  { material: "Steel", tonnage_kg: 30200, carbon_offset_kg_co2e: 4360 },
  { material: "PET Plastic", tonnage_kg: 12800, carbon_offset_kg_co2e: 3580 },
];

// ── Compliance (partner / PRO) ──────────────────────────────────────
const DEMO_MANIFESTO_ITEMS: ManifestoItem[] = [
  { transaction_id: "txn_1042", collector_id: "u_cl_1", collector_phone: "+2348035550101", material_slug: "copper", material_name: "Copper", weight_kg: 84, gross_value_naira: 323400, carbon_offset_kg_co2e: 29.4, hub: "Zaria Green Reclaim Centre", settled_at: daysAgo(0, 13) },
  { transaction_id: "txn_1039", collector_id: "u_cl_2", collector_phone: "+2348051112233", material_slug: "lead-acid-battery", material_name: "Lead-Acid Battery", weight_kg: 122, gross_value_naira: 75640, carbon_offset_kg_co2e: 27.5, hub: "Zaria Green Reclaim Centre", settled_at: daysAgo(1, 12) },
  { transaction_id: "txn_1031", collector_id: "u_cl_1", collector_phone: "+2348035550101", material_slug: "copper", material_name: "Copper", weight_kg: 96, gross_value_naira: 369600, carbon_offset_kg_co2e: 33.6, hub: null, settled_at: daysAgo(2, 11) },
  { transaction_id: "txn_1027", collector_id: "u_cl_3", collector_phone: "+2349062223344", material_slug: "lead-acid-battery", material_name: "Lead-Acid Battery", weight_kg: 200, gross_value_naira: 124000, carbon_offset_kg_co2e: 45.0, hub: "Zaria Green Reclaim Centre", settled_at: daysAgo(3, 10) },
  { transaction_id: "txn_1021", collector_id: "u_cl_2", collector_phone: "+2348051112233", material_slug: "e-waste", material_name: "E-Waste Board", weight_kg: 46, gross_value_naira: 22080, carbon_offset_kg_co2e: 13.2, hub: null, settled_at: daysAgo(4, 15) },
];

export const DEMO_COMPLIANCE: ComplianceManifesto = {
  partner_id: "prt_demo",
  partner_name: "Recircle PRO Nigeria",
  partner_type: "pro",
  generated_at: new Date().toISOString(),
  total_transactions: 5,
  total_tonnage_kg: 548,
  total_carbon_offset_kg_co2e: 148.7,
  total_collector_income_naira: 914720,
  items: DEMO_MANIFESTO_ITEMS,
};

// ── Household scanning demo ─────────────────────────────────────────
export const DEMO_RECENT_SCANS = [
  { label: "Copper", weight: 3.2, value: 12320, time: daysAgo(0, 9), confidence: 0.96 },
  { label: "Lead-Acid Battery", weight: 12.5, value: 7750, time: daysAgo(2, 11), confidence: 0.91 },
  { label: "Aluminum", weight: 6.0, value: 5700, time: daysAgo(4, 14), confidence: 0.88 },
  { label: "PET Plastic", weight: 8.0, value: 1640, time: daysAgo(6, 10), confidence: 0.85 },
] as const;