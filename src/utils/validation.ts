// src/utils/validation.ts
/** Simple helper to validate that a URL is a Google Maps link */
export const isGoogleMapsUrl = (url: string): boolean => {
  if (!url.startsWith('https://')) return false;
  const allowed = [
    'google.com/maps',
    'maps.app.goo.gl',
    'goo.gl/maps'
  ];
  return allowed.some(p => url.includes(p));
};
