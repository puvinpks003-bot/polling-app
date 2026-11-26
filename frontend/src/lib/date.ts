/**
 * Indian Standard Time (Asia/Kolkata / IST, UTC+05:30) Utility
 * 
 * Provides robust datetime localization for all SG ONE components:
 * - Date display format: DD-MM-YYYY (e.g. 25-11-2026)
 * - DateTime display format: DD-MM-YYYY hh:mm:ss A (IST)
 * - Timezone-aware input helpers for datetime-local (YYYY-MM-DDTHH:mm) and date (YYYY-MM-DD)
 * - Safe parsing for SQLite naive timestamps, ISO strings, and pre-formatted strings
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns an object with the 2-digit day, month, year, hour, minute, second in Asia/Kolkata
 */
export function getKolkataDateParts(inputDate: Date | string | number = new Date()) {
  let parseable = inputDate;
  if (typeof inputDate === 'string') {
    let s = inputDate.trim();
    // If backend sent YYYY-MM-DD HH:MM:SS without timezone, treat as UTC
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    }
    parseable = s;
  }

  const d = typeof parseable === 'object' ? parseable : new Date(parseable);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const formatter24 = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formatter12 = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const parts24 = formatter24.formatToParts(validDate);
  const parts12 = formatter12.formatToParts(validDate);

  const get24 = (t: string) => parts24.find(p => p.type === t)?.value || '00';
  const get12 = (t: string) => parts12.find(p => p.type === t)?.value || '00';

  return {
    day: get24('day'),
    month: get24('month'),
    year: get24('year'),
    hour24: get24('hour'),
    minute: get24('minute'),
    second: get24('second'),
    hour12: get12('hour'),
    dayPeriod: parts12.find(p => p.type === 'dayPeriod')?.value?.toUpperCase() || 'AM',
  };
}

/**
 * Formats date and time in Indian Standard Time (IST)
 * Output example: 25-11-2026 05:35:44 PM (or with optional IST suffix)
 */
export function formatIndiaDateTime(
  dateInput: string | Date | null | undefined,
  includeTzSuffix: boolean = false
): string {
  if (!dateInput) return '—';

  // If already formatted in DD-MM-YYYY format, return cleanly
  if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{4}/.test(dateInput.trim())) {
    const trimmed = dateInput.trim();
    if (includeTzSuffix && !trimmed.includes('IST')) {
      return `${trimmed} IST`;
    }
    return trimmed;
  }

  const p = getKolkataDateParts(dateInput);
  const formatted = `${p.day}-${p.month}-${p.year} ${p.hour12}:${p.minute}:${p.second} ${p.dayPeriod}`;
  return includeTzSuffix ? `${formatted} IST` : formatted;
}

/**
 * Formats strictly as DD-MM-YYYY in Indian Standard Time
 * Output example: 25-11-2026
 */
export function formatIndiaDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';

  // If already in DD-MM-YYYY format
  if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  // Handle YYYY-MM-DD input
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [y, m, day] = dateInput.trim().split('-');
    return `${day}-${m}-${y}`;
  }

  const p = getKolkataDateParts(dateInput);
  return `${p.day}-${p.month}-${p.year}`;
}

/**
 * Formats time only in Indian Standard Time
 * Output example: 05:35 PM
 */
export function formatIndiaTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const p = getKolkataDateParts(dateInput);
  return `${p.hour12}:${p.minute} ${p.dayPeriod}`;
}

/**
 * Generates an input string for HTML <input type="datetime-local" /> in Indian Standard Time (YYYY-MM-DDTHH:mm)
 */
export function getKolkataDatetimeLocalString(inputDate: Date | string = new Date()): string {
  const p = getKolkataDateParts(inputDate);
  return `${p.year}-${p.month}-${p.day}T${p.hour24}:${p.minute}`;
}

/**
 * Generates an input string for HTML <input type="date" /> in Indian Standard Time (YYYY-MM-DD)
 */
export function getKolkataDateInputString(inputDate: Date | string = new Date()): string {
  const p = getKolkataDateParts(inputDate);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Converts a datetime-local input string (YYYY-MM-DDTHH:mm) to ISO 8601 with explicit IST offset (+05:30)
 */
export function toKolkataIsoString(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) return '';
  const clean = datetimeLocalValue.trim();
  if (clean.includes('+') || clean.endsWith('Z')) return clean;
  return `${clean}:00+05:30`;
}
