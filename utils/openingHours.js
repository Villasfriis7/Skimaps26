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

// Det er dyrt at oprette en Intl-formatter (især på Android), og en liste med
// 300 steder spørger om "åben nu" for hvert sted - så vi laver én pr. tidszone.
const formatters = new Map();
function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    );
  }
  return formatters.get(timeZone);
}

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

// Ugedag (Mo = 0) og minutter efter midnat i skiområdets tidszone - ikke på
// telefonen, så "åben nu" også passer, hvis brugeren sidder et andet sted.
// Kender vi ikke områdets tidszone, bruges telefonens egen tid.
export function resortTime(now = new Date(), timeZone = null) {
  if (timeZone) {
    try {
      const parts = formatterFor(timeZone).formatToParts(now);
      const get = (type) => parts.find((p) => p.type === type)?.value;
      const day = DAYS.indexOf((get('weekday') || '').slice(0, 2));
      const minutes = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
      if (day !== -1 && !Number.isNaN(minutes)) return { day, minutes };
    } catch {
      // Intl med tidszone findes ikke på alle enheder - brug telefonens tid.
    }
  }
  return { day: (now.getDay() + 6) % 7, minutes: now.getHours() * 60 + now.getMinutes() };
}

// true = åben nu, false = lukket nu, null = ved ikke (kan ikke læse formatet).
export function isOpenNow(text, timeZone, now = new Date()) {
  const rules = parseOpeningHours(text);
  if (!rules) return null;
  const { day, minutes } = resortTime(now, timeZone);
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

const DAY_NAMES = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };

// Gør OSM's rå tekst pænere at læse, uden at ændre indholdet: én regel pr.
// linje, hele dagsnavne-forkortelser og tankestreg i intervaller.
//   "Mo-Th 07:00-23:00; Su 07:00-16:00" -> ["Mon–Thu 07:00–23:00", "Sun 07:00–16:00"]
export function formatOpeningHours(text) {
  if (!text) return [];
  return text
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) =>
      rule
        .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (day) => DAY_NAMES[day])
        .replace(/\bPH\b/g, 'public holidays')
        .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, '$1–$2')
        .replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, '$1–$2')
        .replace(/,(?=\S)/g, ', ')
        .replace(/^week /, 'Week ')
    );
}
