import type { MaterialCategoryInfo } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const CACHE_KEY = "inteliscrap_materials";

let cache: MaterialCategoryInfo[] | null = null;

export async function fetchMaterials(): Promise<MaterialCategoryInfo[]> {
  if (cache) return cache;

  const res = await fetch(`${API_BASE}/api/v1/materials`);
  if (!res.ok) throw new Error(`Failed to fetch materials: ${res.statusText}`);
  cache = (await res.json()) as MaterialCategoryInfo[];

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage may be unavailable; cache stays in-memory
  }
  return cache;
}

export async function getCategoryBySlug(
  slug: string,
): Promise<MaterialCategoryInfo | undefined> {
  const materials = await fetchMaterials();
  return materials.find((m) => m.slug === slug);
}
