import { lifts, pistes, verbierRegion, towns } from '../verbierMap';
import { elevations } from '../elevations';
import { places } from '../places';
import { pois } from '../pois';
import { toilets } from '../toilets';
import { friends } from '../friends';
import { partners } from '../partners';

// Verbier er det skiområde, appen er bygget omkring, og det eneste med
// håndlavet indhold: fem udvalgte steder med beskrivelser, eksempel-venner og
// eksempel-partnere. Det ligger indbygget, så appen altid virker - også uden
// net og til en fremvisning.
//
// Alle skiområder har denne form (se også utils/resortData.js, der bygger
// den samme form for hentede områder):
//   id, name, country
//   convention     'europe' | 'north_america' | 'japan' - pistefarverne
//   region         kortudsnit, der viser hele området
//   weatherPoint   hvor vejret hentes for (landsbyen), weatherElevation i meter
//   timeZone       til "Open now"
//   lifts, pistes, elevations, towns, places, toilets
//   pois           udvalgte steder med egen beskrivelse (kun Verbier)
//   friends, partners   eksempeldata (kun Verbier)
export const verbier = {
  id: 'verbier',
  name: 'Verbier',
  country: 'Switzerland',
  convention: 'europe',
  bundled: true,
  region: verbierRegion,
  weatherPoint: { latitude: 46.0961, longitude: 7.2286 },
  weatherPointFixed: true,
  weatherElevation: 1500,
  timeZone: 'Europe/Zurich',
  // Médran er Verbiers hovedlift og derfor startpunkt, når vi ikke kender
  // brugerens position.
  defaultLiftName: 'Médran',
  towns,
  lifts,
  pistes,
  elevations,
  places,
  pois,
  toilets,
  friends,
  partners,
};
