// Use relative path so Vite proxy routes requests through the ngrok tunnel
export const API_BASE = '/api/auth';

// Returns { exists, verified }, or null when the backend predates /auth/lookup
// (the sign-in screen then falls back to "try sign-in, else create account").
export async function lookupEmail(email) {
  try {
    const res = await fetch(`${API_BASE}/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function customSignUp(email, password) {
  const res = await fetch(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Signup failed');
  return data;
}

export async function customVerify(email, otp) {
  const res = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Verification failed');
  return data;
}

export async function customSignIn(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  return data;
}

export async function customRequestReset(email) {
  const res = await fetch(`${API_BASE}/request-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to request reset');
  return data;
}

export async function customConfirmReset(email, otp, new_password) {
  const res = await fetch(`${API_BASE}/confirm-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, new_password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to confirm reset');
  return data;
}

export function setCustomSession(token, user) {
  localStorage.setItem('custom_token', token);
  localStorage.setItem('custom_user', JSON.stringify(user));
}

export function getCustomSession() {
  const token = localStorage.getItem('custom_token');
  const user = localStorage.getItem('custom_user');
  if (!token || !user) return null;
  try {
    return { token, user: JSON.parse(user) };
  } catch {
    clearCustomSession();
    return null;
  }
}

export function setCachedProfile(profile) {
  localStorage.setItem('dori_profile', JSON.stringify(profile));
}

export function getCachedProfile() {
  try {
    const profile = localStorage.getItem('dori_profile');
    return profile ? JSON.parse(profile) : null;
  } catch {
    localStorage.removeItem('dori_profile');
    return null;
  }
}

export function clearCustomSession() {
  localStorage.removeItem('custom_token');
  localStorage.removeItem('custom_user');
  localStorage.removeItem('dori_profile');
}
