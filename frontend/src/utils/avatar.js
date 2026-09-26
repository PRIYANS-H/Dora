// Seeded/demo accounts point at stock portraits of strangers. Those are not the
// person's own photo, so they fall back to the DORI logo like an empty avatar.
const STOCK_PHOTO_HOSTS = /(^|\.)(unsplash\.com|randomuser\.me|pravatar\.cc|thispersondoesnotexist\.com|picsum\.photos|ui-avatars\.com)$/i;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><radialGradient id="g" cx="28%" cy="14%" r="110%"><stop offset="0" stop-color="#2e5f86"/><stop offset=".52" stop-color="#10273a"/><stop offset="1" stop-color="#04070b"/></radialGradient><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="32"><rect width="96" height="32" fill="#fff"/><path d="M13 4c7 0 13 5.5 13 12S20 28 13 28" fill="none" stroke="#000" stroke-width="2"/><circle cx="44" cy="16" r="5" fill="#000"/></mask></defs><rect width="128" height="128" fill="url(#g)"/><g transform="translate(27 52.6) scale(.77)" fill="#fff" mask="url(#m)"><path d="M2 4h10c8 0 14 5.5 14 12S20 28 12 28H2V4z"/><circle cx="44" cy="16" r="12"/><rect x="60" y="4" width="4" height="24" rx="2"/><path d="M64 16l12-12v24L64 16z"/></g></svg>`;

export const DORI_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG)}`;

export function isRealPhoto(url) {
  if (!url || !String(url).trim()) return false;
  try {
    const { hostname } = new URL(url, window.location.origin);
    return !STOCK_PHOTO_HOSTS.test(hostname);
  } catch {
    return false;
  }
}

export function avatarSrc(url) {
  return isRealPhoto(url) ? url : DORI_LOGO;
}

export function handleAvatarError(event) {
  if (event.target.src === DORI_LOGO) return;
  event.target.onerror = null;
  event.target.src = DORI_LOGO;
}
