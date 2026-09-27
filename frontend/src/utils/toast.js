const listeners = new Set();

export function toast(message, tone = 'ok') {
  const item = { id: `${Date.now()}-${Math.random()}`, message, tone };
  listeners.forEach((listener) => listener(item));
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
