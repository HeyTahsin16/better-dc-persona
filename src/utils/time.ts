// Returns the current { hour, minute, dateStr } in a given IANA timezone,
// using the built-in Intl API so no extra date/timezone library is needed.
export function getCurrentTimeInZone(timezone: string): { hour: number; minute: number; dateStr: string } {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
    const hour = parseInt(get('hour'), 10) % 24; // Intl can return "24" for midnight in some locales
    const minute = parseInt(get('minute'), 10);
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
    return { hour, minute, dateStr };
  } catch {
    // Invalid timezone string — fall back to UTC
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dateStr: now.toISOString().slice(0, 10),
    };
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
