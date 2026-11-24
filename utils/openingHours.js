// "Åben nu?" ud fra OSM's opening_hours-format.
//
// Formatet er stort (uger, måneder, helligdage, fritekst ...), så vi forstår
// bevidst kun de almindelige former:
//   "24/7"
//   "Mo-Su 12:00-22:00"
//   "Mo-Th 07:00-23:00; Fr-Sa 07:00-24:00; Su 07:00-16:00"
//   "Mo, Tu, Th-Sa 08:00-23:00; We 08:00-17:00"
//   "Mo-Fr 10:00-12:00,14:00-18:00"
//   "Su off"
// Alt andet (fx "week 48-53 ...", "Jun-Oct ...", "18:00 - Late") giver null,
// og så viser appen bare den rå tekst i stedet for at gætte.

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const RESORT_TIME_ZONE = 'Europe/Zurich';

// "Mo-Th" / "Mo, Sa" / "Mo, Tu, Th-Sa" -> mængde af dagsindeks (Mo = 0).
function parseDays(text) {
  const days = new Set();
  for (const part of text.split(',')) {
    const [from, to] = part.trim().split('-');
    const start = DAYS.indexOf(from);
    const end = to === undefined ? start : DAYS.indexOf(to);
    if (start === -1 || end === -1) return null;
    for (let day = start; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === end) break;
    }
  }
  return days;
}

// "07:00-23:00,14:00-18:00" -> [[420, 1380], [840, 1080]] (minutter efter midnat).
function parseTimes(text) {
  const ranges = [];
  for (const part of text.split(',')) {
    const match = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const open = Number(match[1]) * 60 + Number(match[2]);
    let close = Number(match[3]) * 60 + Number(match[4]);
    if (close <= open) close += 24 * 60; // lukker efter midnat
    ranges.push([open, close]);
  }
  return ranges;
}

// Returnerer en liste af regler { days:Set, ranges:[[åbner, lukker]] } eller null.
export function parseOpeningHours(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === '24/7') return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 24 * 60]] }];

  const rules = [];
  for (const rawRule of trimmed.split(';')) {
    const rule = rawRule.trim();
    if (!rule) continue;
    // Del reglen i "dage" og "tider" ved første ciffer (eller ordet off/closed).
    const match = rule.match(/^([A-Za-z,\s-]*?)\s*(\d.*|off|closed)$/);
    if (!match) return null;
    const dayText = match[1].trim();
    const days = dayText ? parseDays(dayText) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    const ranges = /^(off|closed)$/.test(match[2]) ? [] : parseTimes(match[2]);
    if (!ranges) return null;
    rules.push({ days, ranges });
  }
  return rules.length ? rules : null;
}

// Ugedag (Mo = 0) og minutter efter midnat i Verbier - ikke på telefonen,
// så "åben nu" også passer, hvis brugeren sidder i en anden tidszone.
export function resortTime(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: RESORT_TIME_ZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const day = DAYS.indexOf((get('weekday') || '').slice(0, 2));
    const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    if (day !== -1 && !Number.isNaN(minutes)) return { day, minutes };
  } catch {
    // Intl med tidszone findes ikke på alle enheder - brug telefonens tid.
  }
  return { day: (now.getDay() + 6) % 7, minutes: now.getHours() * 60 + now.getMinutes() };
}

// true = åben nu, false = lukket nu, null = ved ikke (kan ikke læse formatet).
export function isOpenNow(text, now = new Date()) {
  const rules = parseOpeningHours(text);
  if (!rules) return null;
  const { day, minutes } = resortTime(now);
  const yesterday = (day + 6) % 7;

  // I OSM gælder den SIDSTE regel, der nævner en dag, for den dag.
  const rangesFor = (weekday) => {
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i].days.has(weekday)) return rules[i].ranges;
    }
    return [];
  };

  const openToday = rangesFor(day).some(([open, close]) => minutes >= open && minutes < close);
  // Åbnede i går og lukker efter midnat (fx 18:00-02:00)?
  const openSinceYesterday = rangesFor(yesterday).some(
    ([open, close]) => close > 24 * 60 && minutes + 24 * 60 < close && minutes + 24 * 60 >= open
  );
  return openToday || openSinceYesterday;
}
