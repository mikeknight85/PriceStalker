const fallbackDestination = '/?tab=products';

export function postAuthDestination(search: string): string {
  const redirect = new URLSearchParams(search).get('redirect');
  if (!redirect) return fallbackDestination;

  try {
    const destination = new URL(redirect, window.location.origin);
    if (destination.origin !== window.location.origin) return fallbackDestination;

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallbackDestination;
  }
}
