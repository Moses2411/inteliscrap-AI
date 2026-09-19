import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export async function shareMyLocation(): Promise<void> {
  const coords = await getCurrentPosition();
  const res = await fetch(`${API_BASE}/api/v1/users/me/location`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
    }),
  });
  if (!res.ok) throw new Error(`Could not update location: ${res.statusText}`);
}