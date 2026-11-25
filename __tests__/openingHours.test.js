import { parseOpeningHours, resortTime, isOpenNow, formatOpeningHours } from '../utils/openingHours';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
// Gør reglerne lette at sammenligne: Set -> sorteret liste.
const plain = (rules) => rules && rules.map((rule) => ({ days: [...rule.days].sort(), ranges: rule.ranges }));

// Faste tidspunkter. Januar 2026: mandag den 5., lørdag den 10., søndag den 11.
// Zürich er UTC+1 om vinteren, Vancouver UTC-8 og Tokyo UTC+9.
const utc = (iso) => new Date(`${iso}:00Z`);

describe('parseOpeningHours - de formater, appen forstår', () => {
  test('"24/7"', () => {
    expect(plain(parseOpeningHours('24/7'))).toEqual([{ days: ALL_DAYS, ranges: [[0, 1440]] }]);
  });

  test('"Mo-Su 12:00-22:00"', () => {
    expect(plain(parseOpeningHours('Mo-Su 12:00-22:00'))).toEqual([{ days: ALL_DAYS, ranges: [[720, 1320]] }]);
  });

  test('flere regler adskilt af semikolon', () => {
    expect(plain(parseOpeningHours('Mo-Th 07:00-23:00; Fr-Sa 07:00-24:00; Su 07:00-16:00'))).toEqual([
      { days: [0, 1, 2, 3], ranges: [[420, 1380]] },
      { days: [4, 5], ranges: [[420, 1440]] },
      { days: [6], ranges: [[420, 960]] },
    ]);
  });

  test('opremsede dage og dagsintervaller blandet', () => {
    expect(plain(parseOpeningHours('Mo, Tu, Th-Sa 08:00-23:00; We 08:00-17:00'))).toEqual([
      { days: [0, 1, 3, 4, 5], ranges: [[480, 1380]] },
      { days: [2], ranges: [[480, 1020]] },
    ]);
  });

  test('to åbningstider samme dag (middagslukket)', () => {
    expect(plain(parseOpeningHours('Mo-Fr 10:00-12:00,14:00-18:00'))).toEqual([
      {
        days: [0, 1, 2, 3, 4],
        ranges: [
          [600, 720],
          [840, 1080],
        ],
      },
    ]);
  });

  test('"Su off" og "closed" er en regel uden åbningstid', () => {
    expect(plain(parseOpeningHours('Su off'))).toEqual([{ days: [6], ranges: [] }]);
    expect(plain(parseOpeningHours('Mo-Fr closed'))).toEqual([{ days: [0, 1, 2, 3, 4], ranges: [] }]);
  });

  test('uden dage gælder tiden hele ugen', () => {
    expect(plain(parseOpeningHours('09:00-17:00'))).toEqual([{ days: ALL_DAYS, ranges: [[540, 1020]] }]);
  });

  test('lukker efter midnat: lukketiden lægges ind på næste døgn', () => {
    expect(plain(parseOpeningHours('Fr-Sa 18:00-02:00'))).toEqual([{ days: [4, 5], ranges: [[1080, 1560]] }]);
    // "Mo-Su 09:30-00:00" (Borsalino i Verbier) lukker ved midnat.
    expect(plain(parseOpeningHours('Mo-Su 09:30-00:00'))).toEqual([{ days: ALL_DAYS, ranges: [[570, 1440]] }]);
  });

  test('et dagsinterval kan gå hen over weekenden', () => {
    expect(plain(parseOpeningHours('Sa-Mo 10:00-12:00'))).toEqual([{ days: [0, 5, 6], ranges: [[600, 720]] }]);
  });

  test('ekstra mellemrum og et afsluttende semikolon gør ikke noget', () => {
    expect(plain(parseOpeningHours('  Mo-Fr 10:00 - 12:00 ;  '))).toEqual([
      { days: [0, 1, 2, 3, 4], ranges: [[600, 720]] },
    ]);
    expect(plain(parseOpeningHours('Mo-Su 9:00-16:45'))).toEqual([{ days: ALL_DAYS, ranges: [[540, 1005]] }]);
  });
});

describe('parseOpeningHours - alt andet giver null, så appen viser teksten uændret', () => {
  test.each([
    [null],
    [undefined],
    [''],
    ['   '],
    [' ; '],
    // Rigtige eksempler fra Verbier-dataene (data/places.js):
    ['Nov-Apr unknown "winter only, unknown times"'],
    ['Dec 23-Feb 17 09:00-16:15; Feb 18-Apr 23 Mo-Su 9:00-16:45'],
    ['week 48-53 Mo-Su,PH 09:00-15:30; week 01-07 Mo-Su,PH 09:00-15:30'],
    // Og andre ting, OpenStreetMap tillader:
    ['18:00 - Late'],
    ['PH off'],
    ['Mo-Su'],
    ['Mo-Fr 10:00+'],
    ['sunrise-sunset'],
    ['Mo-Fr 08:00-12:00, Sa 09:00-12:00'],
    ['Mo-Fr: 09:00-17:00'],
    ['mo-fr 10:00-12:00'],
    ['Mo-Xx 10:00-12:00'],
  ])('%p', (text) => {
    expect(parseOpeningHours(text)).toBeNull();
  });

  test('én ulæselig regel gør hele teksten ulæselig - vi gætter ikke på resten', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-17:00; Dec 24 off')).toBeNull();
  });
});

describe('resortTime', () => {
  test('ugedag (mandag = 0) og minutter efter midnat i skiområdets tidszone', () => {
    // Mandag kl. 11:30 UTC er 12:30 i Zürich.
    expect(resortTime(utc('2026-01-05T11:30'), 'Europe/Zurich')).toEqual({ day: 0, minutes: 750 });
    // Søndag er dag 6.
    expect(resortTime(utc('2026-01-11T11:30'), 'Europe/Zurich')).toEqual({ day: 6, minutes: 750 });
  });

  test('samme øjeblik er forskellige dage i Vancouver og Tokyo', () => {
    const now = utc('2026-01-10T20:00'); // lørdag aften UTC
    expect(resortTime(now, 'America/Vancouver')).toEqual({ day: 5, minutes: 12 * 60 }); // lørdag 12:00
    expect(resortTime(now, 'Asia/Tokyo')).toEqual({ day: 6, minutes: 5 * 60 }); // søndag 05:00
  });

  test('midnat er minut 0 - ikke 24:00', () => {
    // Nogle telefoner skriver midnat som "24:00" med hour12: false.
    expect(resortTime(utc('2026-01-05T23:00'), 'Europe/Zurich')).toEqual({ day: 1, minutes: 0 });
  });

  test('sommertid følger tidszonen', () => {
    // I juli er Zürich UTC+2.
    expect(resortTime(utc('2026-07-06T10:00'), 'Europe/Zurich')).toEqual({ day: 0, minutes: 12 * 60 });
  });

  test('uden tidszone bruges telefonens egen tid', () => {
    // new Date(år, måned, dag, time, minut) er telefonens lokale tid, så
    // testen giver det samme, uanset hvilken tidszone maskinen står i.
    expect(resortTime(new Date(2026, 0, 5, 12, 30), null)).toEqual({ day: 0, minutes: 750 });
    expect(resortTime(new Date(2026, 0, 11, 0, 5))).toEqual({ day: 6, minutes: 5 });
  });

  test('en tidszone, telefonen ikke kender, falder tilbage til telefonens tid', () => {
    expect(resortTime(new Date(2026, 0, 5, 12, 30), 'Mars/Olympus_Mons')).toEqual({ day: 0, minutes: 750 });
  });
});

describe('isOpenNow', () => {
  const zurich = 'Europe/Zurich';

  test('åben og lukket inden for dagens tider', () => {
    const hours = 'Mo-Su 12:00-22:00'; // Chez Dany
    expect(isOpenNow(hours, zurich, utc('2026-01-05T10:59'))).toBe(false); // 11:59
    expect(isOpenNow(hours, zurich, utc('2026-01-05T11:00'))).toBe(true); // 12:00 - åbner
    expect(isOpenNow(hours, zurich, utc('2026-01-05T20:59'))).toBe(true); // 21:59
    expect(isOpenNow(hours, zurich, utc('2026-01-05T21:00'))).toBe(false); // 22:00 - lukker
  });

  test('"24/7" er altid åben', () => {
    expect(isOpenNow('24/7', zurich, utc('2026-01-05T02:13'))).toBe(true);
    expect(isOpenNow('24/7', zurich, utc('2026-01-11T22:59'))).toBe(true);
  });

  test('middagslukket', () => {
    const hours = 'Mo-Fr 10:00-12:00,14:00-18:00';
    expect(isOpenNow(hours, zurich, utc('2026-01-05T10:00'))).toBe(true); // 11:00
    expect(isOpenNow(hours, zurich, utc('2026-01-05T12:00'))).toBe(false); // 13:00
    expect(isOpenNow(hours, zurich, utc('2026-01-05T14:00'))).toBe(true); // 15:00
    expect(isOpenNow(hours, zurich, utc('2026-01-10T10:00'))).toBe(false); // lørdag
  });

  test('åbent til efter midnat gælder ind på næste dag', () => {
    const hours = 'Fr-Sa 18:00-02:00';
    expect(isOpenNow(hours, zurich, utc('2026-01-10T21:30'))).toBe(true); // lørdag 22:30
    expect(isOpenNow(hours, zurich, utc('2026-01-11T00:00'))).toBe(true); // søndag 01:00 - åbnede lørdag
    expect(isOpenNow(hours, zurich, utc('2026-01-11T01:00'))).toBe(false); // søndag 02:00 - lukket
    expect(isOpenNow(hours, zurich, utc('2026-01-11T18:00'))).toBe(false); // søndag 19:00 - åbner ikke søndag
    expect(isOpenNow(hours, zurich, utc('2026-01-09T00:00'))).toBe(false); // fredag 01:00 - åbnede ikke torsdag
  });

  test('søndag nat tæller med fra en søndagsregel, selvom det er blevet mandag', () => {
    const hours = 'Su 20:00-03:00';
    expect(isOpenNow(hours, zurich, utc('2026-01-12T01:00'))).toBe(true); // mandag 02:00
    expect(isOpenNow(hours, zurich, utc('2026-01-12T02:30'))).toBe(false); // mandag 03:30
  });

  test('"off" lukker dagen', () => {
    const hours = 'Mo-Su 09:00-17:00; Su off';
    expect(isOpenNow(hours, zurich, utc('2026-01-10T11:00'))).toBe(true); // lørdag 12:00
    expect(isOpenNow(hours, zurich, utc('2026-01-11T11:00'))).toBe(false); // søndag 12:00
    expect(isOpenNow('off', zurich, utc('2026-01-05T11:00'))).toBe(false);
  });

  test('den sidste regel, der nævner dagen, gælder (som i OpenStreetMap)', () => {
    const hours = 'Mo-Su 08:00-20:00; Sa 10:00-14:00';
    expect(isOpenNow(hours, zurich, utc('2026-01-10T08:00'))).toBe(false); // lørdag 09:00
    expect(isOpenNow(hours, zurich, utc('2026-01-10T12:00'))).toBe(true); // lørdag 13:00
    expect(isOpenNow(hours, zurich, utc('2026-01-10T14:00'))).toBe(false); // lørdag 15:00
    expect(isOpenNow(hours, zurich, utc('2026-01-09T14:00'))).toBe(true); // fredag 15:00
    // Rækkefølgen betyder noget: her vinder hele-ugen-reglen over lørdagen.
    expect(isOpenNow('Sa 10:00-14:00; Mo-Su 08:00-20:00', zurich, utc('2026-01-10T14:00'))).toBe(true);
  });

  test('en dag, ingen regel nævner, er lukket', () => {
    expect(isOpenNow('Mo-Fr 09:00-17:00', zurich, utc('2026-01-10T11:00'))).toBe(false);
  });

  test('regnes i skiområdets tidszone, ikke telefonens', () => {
    const hours = 'Mo-Su 08:00-16:00';
    const now = utc('2026-01-10T20:00'); // lørdag 21:00 i Zürich, 12:00 i Vancouver, søndag 05:00 i Tokyo
    expect(isOpenNow(hours, 'Europe/Zurich', now)).toBe(false);
    expect(isOpenNow(hours, 'America/Vancouver', now)).toBe(true);
    expect(isOpenNow(hours, 'Asia/Tokyo', now)).toBe(false);
    // Ugedagen følger også tidszonen: det er lørdag i Vancouver, søndag i Tokyo.
    expect(isOpenNow('Sa 08:00-16:00', 'America/Vancouver', now)).toBe(true);
    expect(isOpenNow('Su 04:00-06:00', 'Asia/Tokyo', now)).toBe(true);
  });

  test('uden tidszone bruges telefonens tid', () => {
    const hours = 'Mo-Fr 09:00-17:00';
    expect(isOpenNow(hours, null, new Date(2026, 0, 5, 12, 0))).toBe(true); // mandag 12:00
    expect(isOpenNow(hours, null, new Date(2026, 0, 5, 18, 0))).toBe(false); // mandag 18:00
    expect(isOpenNow(hours, null, new Date(2026, 0, 10, 12, 0))).toBe(false); // lørdag
    expect(isOpenNow(hours, undefined, new Date(2026, 0, 6, 9, 0))).toBe(true); // tirsdag 09:00
  });

  test('ulæselige åbningstider giver null - "ved ikke"', () => {
    expect(isOpenNow('18:00 - Late', zurich, utc('2026-01-05T11:00'))).toBeNull();
    expect(isOpenNow(null, zurich, utc('2026-01-05T11:00'))).toBeNull();
    expect(isOpenNow('week 48-53 Mo-Su,PH 09:00-15:30', zurich, utc('2026-01-05T11:00'))).toBeNull();
  });

  test('uden tidspunkt bruges "nu"', () => {
    expect(isOpenNow('24/7', zurich)).toBe(true);
    expect(isOpenNow('off', zurich)).toBe(false);
  });
});

describe('formatOpeningHours', () => {
  test('én regel pr. linje med dagsnavne og tankestreger', () => {
    expect(formatOpeningHours('Mo-Th 07:00-23:00; Su 07:00-16:00')).toEqual([
      'Mon–Thu 07:00–23:00',
      'Sun 07:00–16:00',
    ]);
  });

  test('luft efter kommaer', () => {
    expect(formatOpeningHours('Mo,Tu 10:00-12:00,14:00-18:00')).toEqual(['Mon, Tue 10:00–12:00, 14:00–18:00']);
  });

  test('helligdage og uger skrives ud', () => {
    expect(formatOpeningHours('week 48-53 Mo-Su,PH 09:00-15:30')).toEqual([
      'Week 48-53 Mon–Sun, public holidays 09:00–15:30',
    ]);
    expect(formatOpeningHours('PH off')).toEqual(['public holidays off']);
  });

  test('tekst, vi ikke forstår, vises uændret', () => {
    expect(formatOpeningHours('24/7')).toEqual(['24/7']);
    expect(formatOpeningHours('18:00 - Late')).toEqual(['18:00 - Late']);
    expect(formatOpeningHours('Nov-Apr unknown "winter only, unknown times"')).toEqual([
      'Nov-Apr unknown "winter only, unknown times"',
    ]);
  });

  test('ingen tekst giver en tom liste', () => {
    expect(formatOpeningHours(null)).toEqual([]);
    expect(formatOpeningHours('')).toEqual([]);
    expect(formatOpeningHours(' ; ')).toEqual([]);
  });
});
