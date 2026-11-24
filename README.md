# Skimaps

Skimaps er en "Google Maps til skisportsområder" - en React Native/Expo-app, der lader
brugeren finde vej i Verbier skiområde via lifter og pister (ikke veje), finde restauranter,
caféer, après-ski, hoteller og ski rental, se venner på kortet og udnytte partner-rabatter.

Appens tekster er på engelsk (målgruppen er internationale skigæster); kode-kommentarer
og denne README er på dansk.

## Funktioner

- **Explore** - overblik over skiområdet med rigtigt, live vejr (Open-Meteo), søgning på
  tværs af steder og lifter, samt genveje til kort og partnere.
- **Map** - interaktivt kort over Verbier med ægte geodata fra OpenStreetMap/OpenSkiMap:
  47 lifter, 275 pist-stykker (farvet efter rigtig sværhedsgrad), 322 steder
  (restauranter/caféer/après-ski/hoteller/ski rental) og 20 offentlige toiletter.
  Baggrunden er swisstopos terrænkort, så bjergene ses som snedækket relief; zoomer man
  ind, anes gader, højdekurver og stednavne, og en knap skifter til det fulde vinter-landkort.
  Stregtykkelse og detaljer følger zoom: på afstand er steder små prikker, tæt på får de
  ikoner, og lifterne får stationer og navne. Filtrérbart via kategori-chips. Tryk på en lift
  eller pist for navn, type, længde og højdeforskel. "Min position"-knappen beder om
  lokationstilladelse og viser, hvor du er.
- **Rutefinding** - "Route here" på et sted beregner den hurtigste vej dertil via lifter og
  pister: vælg startpunkt (din position eller en liftstation) og den sværeste pist, du vil
  køre, og få en trin-for-trin-rute, som også kan vises på kortet.
- **Friends** - venneliste (mock-data, da appen ikke har login endnu). Vennerne vises på
  kortet, og afstanden til dem regnes ud fra din egen position.
- **Partners** - rabatter hos lokale partnere, filtrérbart efter kategori. Tilbuddene er
  eksempler - der er ingen rigtige aftaler endnu, og det står også i appen.
- **Profile** - brugerprofil (mock) og **gemte steder** (rigtige, se nedenfor).

## Sådan virker rutefindingen

`utils/routing.js` bygger en graf af lift- og pistedataene: hvert punkt på en pist og hver
liftstation er en knude. Pister kan kun køres nedad, lifter kun opad (gondoler og kabelbaner
også ned), og liftstationer/pist-ender tæt på hinanden forbindes med korte gå-stykker.
Derefter finder Dijkstras algoritme den hurtigste vej. Tiderne er skøn ud fra typiske
ski- og lifthastigheder, og appen ved ikke, om en lift eller pist er åben i dag.

## Rigtige datakilder (ikke hardcoded)

- **Vejr:** Live data fra [Open-Meteo](https://open-meteo.com) for Verbiers koordinater
  (temperatur, snedybde, snefald, 6-dages udsigt). Hentes, når Explore-fanen åbnes, og
  igen når man vender tilbage til den, hvis tallene er over 10 minutter gamle.
- **Gemte steder:** Brugeren kan trykke på hjerte-ikonet på et steds detaljeside for at
  gemme det. Gemte steder gemmes lokalt med `AsyncStorage` og huskes, selv efter appen
  lukkes og genåbnes (se `context/SavedPlacesContext.js`).
- **Position:** Brugerens GPS-position via `expo-location` (se `context/LocationContext.js`).
- **Kort-/stedsdata:** Lifter, pister, steder og toiletter er hentet fra OpenStreetMap og
  OpenSkiMap.org's åbne datasæt under research-fasen af projektet. Steder og toiletter er
  afgrænset til dem, der ligger højst 1 km fra en lift eller pist. Pistedatasættet rummer
  også 14 stykker skitur-rute, 11 stykker kælkebane og 7 linjer uden sværhedsgrad; de
  tegnes med deres egen farve og indgår ikke i rutefindingen.
- **Højder:** Start- og sluthøjde for hver lift og pist (`data/elevations.js`) er slået op
  i Open-Meteos Elevation API.
- **Åbningstider:** "Open now" på et steds detaljeside regnes ud fra OSM's åbningstider
  (i Verbiers tidszone). Kun de almindelige formater forstås - ellers vises teksten uændret.

Mock-data (opdigtet eksempeldata): venner, partner-rabatter og brugerprofilen.

## Kildeangivelse

- Kort- og stedsdata © [OpenStreetMap](https://www.openstreetmap.org/copyright)-bidragydere
  (ODbL), lift- og pistedata via [OpenSkiMap](https://openskimap.org).
- Baggrundskort (terrænskygge og vinter-landkort) fra Federal Office of Topography
  [©swisstopo](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices).
  Fliserne er gratis og kræver ingen API-nøgle, men dækker kun Schweiz, og tjenesten har
  en fair use-grænse.
- Vejr- og højdedata fra [Open-Meteo](https://open-meteo.com) (CC BY 4.0).

Alle tre krediteres også inde i appen (under kortet og på vejrsiden).

## Tech stack

- Expo (React Native), React Navigation (bund-navigation med 5 faner + stack-navigation
  til detaljesider ovenpå)
- `react-native-maps` til det interaktive kort
- `expo-location` til brugerens position
- `@react-native-async-storage/async-storage` til lokal, persistent lagring
- `@expo/vector-icons` til ikoner

## Mappestruktur

- `screens/` - én fil pr. skærm
- `context/` - delt tilstand: gemte steder, position og aktiv rute
- `utils/` - ren logik uden UI: rutefinding, afstande, åbningstider, links, oprydning i data
- `data/` - geodata, steder og mock-data
- `styles/styles.js` - fælles farver og styles

## Kom i gang

```bash
npm install
npx expo start
```

Demovideo: https://youtube.com/shorts/dreyhnMPcoo?is=fh6kMi-d8DRQtNp1
