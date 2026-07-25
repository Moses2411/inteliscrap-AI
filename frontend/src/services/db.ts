import Dexie, { type Table } from "dexie";
import type { PriceMatrixEntry, ScrapScan } from "../types";

export class InteliScrapDB extends Dexie {
  scans!: Table<ScrapScan, string>;
  prices!: Table<PriceMatrixEntry, string>;

  constructor() {
    super("InteliScrapLocalDB");
    this.version(1).stores({
      scans: "id, user_id, material_class, estimated_naira_value, captured_at, is_synced, is_deleted",
      prices: "material_class, price_per_kg_naira, last_updated",
    });
  }
}

export const db = new InteliScrapDB();

export async function saveScanLocally(scan: ScrapScan): Promise<void> {
  await db.scans.put(scan);
}

export async function getUnsyncedScans(): Promise<ScrapScan[]> {
  return db.scans.filter(s => !s.is_synced).toArray();
}

export async function markScanAsSynced(id: string): Promise<void> {
  await db.scans.update(id, { is_synced: true, synced_at: new Date().toISOString() });
}

export async function softDeleteScan(id: string): Promise<void> {
  await db.scans.update(id, { is_deleted: true });
}

export async function getLocalScans(): Promise<ScrapScan[]> {
  return db.scans.orderBy("captured_at").reverse().filter(s => !s.is_deleted).toArray();
}

export async function cachePrices(prices: PriceMatrixEntry[]): Promise<void> {
  await db.prices.bulkPut(prices);
}

export async function getCachedPrices(): Promise<PriceMatrixEntry[]> {
  return db.prices.toArray();
}

export async function getPriceForMaterial(material_class: string): Promise<PriceMatrixEntry | undefined> {
  return db.prices.get(material_class);
}
