# Skimaps

Skimaps er en "Google Maps til skisportsområder" - en React Native/Expo-app, der lader
brugeren navigere i Verbier skiområde via lifter og pister (ikke veje), finde restauranter,
caféer, après-ski, hoteller og ski rental, dele position med venner, og udnytte partner-rabatter.

## Funktioner

- **Explore** - overblik over skiområdet med rigtigt, live vejr (Open-Meteo), søgning på
  tværs af steder og lifter, samt genveje til kort og partnere.
- **Map** - interaktivt kort over Verbier med ægte geodata fra OpenStreetMap/OpenSkiMap:
  47 lifter, 307 pister (farvet efter rigtig sværhedsgrad), 361 rigtige steder
  (restauranter/caféer/après-ski/hoteller/ski rental) og 31 offentlige toiletter.
  Filtrérbart via kategori-chips, med GPS-position via "min position"-knappen.
- **Friends** - venneliste med live-status og mulighed for at dele position og oprette
  en fælles rute (mock-data, da appen ikke har login endnu).
- **Partners** - rabatter hos lokale partnere, filtrérbart efter kategori.
- **Profile** - brugerprofil, statistik og **gemte steder** (se nedenfor).

## Rigtige datakilder (ikke hardcoded)

- **Vejr:** Live data fra [Open-Meteo](https://open-meteo.com) for Verbiers koordinater -
  hentes ved hvert besøg på Explore-skærmen (aktuel temperatur, sne, 6-dages udsigt).
- **Gemte steder:** Brugeren kan trykke på hjerte-ikonet på et steds detaljeside for at
  gemme det. Gemte steder gemmes lokalt med `AsyncStorage` og huskes, selv efter appen
  lukkes og genåbnes (se `context/SavedPlacesContext.js`).
- **Kort-/stedsdata:** Lifter, pister og de 361 restauranter/caféer/hoteller m.m. er hentet
  fra OpenStreetMap og OpenSkiMap.org's åbne datasæt under research-fasen af projektet.

## Tech stack

- Expo (React Native), React Navigation (bund-navigation med 5 faner + stack-navigation
  til detaljesider ovenpå)
- `react-native-maps` til det interaktive kort
- `@react-native-async-storage/async-storage` til lokal, persistent lagring
- `expo-linear-gradient`, `@expo/vector-icons` til design

## Kom i gang

```bash
npm install
npx expo start
```

Demovideo: https://youtube.com/shorts/dreyhnMPcoo?is=fh6kMi-d8DRQtNp1
