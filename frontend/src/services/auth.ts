const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "inteliscrap_token";
const ROLE_KEY = "inteliscrap_role";
const PHONE_KEY = "inteliscrap_phone";
const ADDRESS_KEY = "inteliscrap_address";

// Never let the login UI spin forever if the server is slow or the network hangs.
const AUTH_TIMEOUT_MS = 15_000;

/** Auth call failure with a user-actionable message and a coarse cause. */
export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "server",
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(ms)
      : undefined;
  } catch {
    return undefined;
  }
}

export type UserRole = "seller" | "collector" | "admin" | "ngo" | "recycling_hub" | "partner";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): UserRole | null {
  const role = localStorage.getItem(ROLE_KEY);
  return role === "seller" ||
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

export function getSavedAddress(): string | null {
  return localStorage.getItem(ADDRESS_KEY);
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

export function setSavedAddress(address: string): void {
  localStorage.setItem(ADDRESS_KEY, address);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ADDRESS_KEY);
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function syncRoleFromServer(): Promise<UserRole | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHeaders() });
    if (!res.ok) return getRole();
    const data: { role: string } = await res.json();
    const role = data.role as UserRole;
    setRole(role);
    return role;
  } catch {
    return getRole();
  }
}

export async function updateRole(role: UserRole): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/users/me/role`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Role update failed");
  const data: { role: string } = await res.json();
  setRole(data.role as UserRole);
}

export async function requestOtp(
  phoneNumber: string,
  role?: UserRole,
  address?: string,
): Promise<{ otp?: string; debug: boolean; retryAfter: number }> {
  const body: { phone_number: string; role?: UserRole; address_text?: string } = { phone_number: phoneNumber };
  if (role) body.role = role;
  if (address) body.address_text = address;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutSignal(AUTH_TIMEOUT_MS),
    });
  } catch {
    throw new AuthRequestError(
      "Couldn't reach the server. Check your connection and try again.",
      "network",
    );
  }
  if (!res.ok) {
    throw new AuthRequestError(
      "Couldn't send the code right now. Please try again in a moment.",
      "server",
    );
  }
  const data: { status: string; otp?: string; user_id: string; retry_after?: number } = await res.json();
  return { otp: data.otp, debug: data.otp != null, retryAfter: data.retry_after ?? 0 };
}

export async function verifyOtp(phoneNumber: string, otpCode: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber, otp_code: otpCode }),
      signal: timeoutSignal(AUTH_TIMEOUT_MS),
    });
  } catch {
    throw new AuthRequestError(
      "Couldn't reach the server. Check your connection and try again.",
      "network",
    );
  }
  if (!res.ok) {
    throw new AuthRequestError("That code didn't match or has expired. Try again.", "server");
  }
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
    const auto = window.prompt(`Demo mode — your OTP is ${otp}\n(you can paste it or press Cancel to type manually, demo code 123456 also works)`);
    const code = auto && auto.trim() ? auto.trim() : otp;
    await verifyOtp(phone, code);
    return true;
  }

  const code = window.prompt("Enter the 6-digit OTP");
  if (!code) return false;
  await verifyOtp(phone, code);
  return true;
}