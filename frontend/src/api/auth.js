export const API_BASE = 'http://localhost:8000/auth';

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

export function setCustomSession(token, user) {
  localStorage.setItem('custom_token', token);
  localStorage.setItem('custom_user', JSON.stringify(user));
}

export function getCustomSession() {
  const token = localStorage.getItem('custom_token');
  const user = localStorage.getItem('custom_user');
  if (!token || !user) return null;
  return { token, user: JSON.parse(user) };
}

export function clearCustomSession() {
  localStorage.removeItem('custom_token');
  localStorage.removeItem('custom_user');
}
