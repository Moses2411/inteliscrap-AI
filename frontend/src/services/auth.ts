const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "inteliscrap_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function requestOtp(phoneNumber: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  if (!res.ok) throw new Error("OTP request failed");
}

export async function verifyOtp(phoneNumber: string, otpCode: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
  });
  if (!res.ok) throw new Error("OTP verification failed");
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

export async function ensureAuthenticated(): Promise<boolean> {
  if (getToken()) return true;
  if (!navigator.onLine) return false;

  const phone = window.prompt("Enter your phone number (e.g. +2348012345678)");
  if (!phone) return false;
  await requestOtp(phone);

  const code = window.prompt("Enter the 6-digit OTP");
  if (!code) return false;
  await verifyOtp(phone, code);
  return true;
}
