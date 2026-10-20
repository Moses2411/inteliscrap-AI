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

/** Fired after any local scan mutation so open screens can refresh themselves. */
export const SCANS_CHANGED_EVENT = "inteliscrap:scans-changed";

function notifyScansChanged(): void {
  window.dispatchEvent(new Event(SCANS_CHANGED_EVENT));
}

export async function saveScanLocally(scan: ScrapScan): Promise<void> {
  await db.scans.put(scan);
  notifyScansChanged();
}

export async function getUnsyncedScans(): Promise<ScrapScan[]> {
  return db.scans.filter(s => !s.is_synced).toArray();
}

export async function markScanAsSynced(id: string): Promise<void> {
  await db.scans.update(id, { is_synced: true, synced_at: new Date().toISOString() });
  notifyScansChanged();
}

/** Mark several scans as synced in one write (used by the sync worker). */
export async function markScansAsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const synced_at = new Date().toISOString();
  await db.scans.bulkUpdate(
    ids.map((id) => ({ key: id, changes: { is_synced: true, synced_at } })),
  );
  notifyScansChanged();
}

export async function softDeleteScan(id: string): Promise<void> {
  // Queue the deletion for the next sync so it also disappears server-side.
  await db.scans.update(id, { is_deleted: true, is_synced: false });
  notifyScansChanged();
}

export async function getLocalScans(includeDeleted = false): Promise<ScrapScan[]> {
  const scans = await db.scans.orderBy("captured_at").reverse().toArray();
  return includeDeleted ? scans : scans.filter((s) => !s.is_deleted);
}

export async function getScanById(id: string): Promise<ScrapScan | undefined> {
  return db.scans.get(id);
}

export async function markScanListed(
  id: string,
  listingId: string,
  listingStatus?: string,
): Promise<void> {
  await db.scans.update(id, {
    listing_id: listingId,
    ...(listingStatus ? { listing_status: listingStatus } : {}),
  });
  notifyScansChanged();
}

/** Persist listing links/statuses discovered from the server in one write. */
export async function updateScanListings(
  updates: Array<{ id: string; listing_id: string; listing_status: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  await db.scans.bulkUpdate(
    updates.map(({ id, listing_id, listing_status }) => ({
      key: id,
      changes: { listing_id, listing_status },
    })),
  );
  notifyScansChanged();
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
