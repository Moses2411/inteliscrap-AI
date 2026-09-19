const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "inteliscrap_token";
const ROLE_KEY = "inteliscrap_role";
const PHONE_KEY = "inteliscrap_phone";

export type UserRole = "household" | "collector" | "admin" | "ngo" | "recycling_hub" | "partner";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): UserRole | null {
  const role = localStorage.getItem(ROLE_KEY);
  return role === "household" ||
    role === "collector" ||
    role === "admin" ||
    role === "ngo" ||
    role === "recycling_hub" ||
    role === "partner"
    ? role
    : null;
}

export function getSavedPhone(): string | null {
  return localStorage.getItem(PHONE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setRole(role: UserRole): void {
  localStorage.setItem(ROLE_KEY, role);
}

export function setSavedPhone(phone: string): void {
  localStorage.setItem(PHONE_KEY, phone);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function requestOtp(
  phoneNumber: string,
  role: UserRole = "household",
): Promise<{ otp?: string; debug: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, role }),
  });
  if (!res.ok) throw new Error("OTP request failed");
  const data: { status: string; otp?: string; user_id: string } = await res.json();
  return { otp: data.otp, debug: data.otp != null };
}

export async function verifyOtp(phoneNumber: string, otpCode: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
  });
  if (!res.ok) throw new Error("OTP verification failed");
  const data: { access_token: string; role: string } = await res.json();
  setToken(data.access_token);
  setRole(data.role as UserRole);
  setSavedPhone(phoneNumber);
  return data.access_token;
}

export async function ensureAuthenticated(): Promise<boolean> {
  if (getToken()) return true;
  if (!navigator.onLine) return false;

  const phone = window.prompt("Enter your phone number (e.g. +2348012345678)");
  if (!phone) return false;
  const { otp, debug } = await requestOtp(phone);

  if (debug && otp) {
    const auto = window.prompt(`Demo mode — your OTP is ${otp}\n(you can paste it or press Cancel to type manually, demo code ${"123456"} also works)`);
    const code = auto && auto.trim() ? auto.trim() : otp;
    await verifyOtp(phone, code);
    return true;
  }

  const code = window.prompt("Enter the 6-digit OTP");
  if (!code) return false;
  await verifyOtp(phone, code);
  return true;
}