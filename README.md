# Skimaps

Skimaps er en "Google Maps til skisportsområder" - en React Native/Expo-app, der lader
brugeren finde vej i et skiområde via lifter og pister (ikke veje), finde restauranter,
caféer, après-ski, hoteller og ski rental, se venner på kortet og udnytte partner-rabatter.

Appen starter i Verbier, som den er bygget omkring, men man kan skifte til et hvilket som
helst skiområde i verden (se "Skift af skiområde" nedenfor).

Appens tekster er på engelsk (målgruppen er internationale skigæster); kode-kommentarer
og denne README er på dansk.

## Funktioner

- **Explore** - overblik over skiområdet med rigtigt, live vejr (Open-Meteo), genveje og
  søgning på tværs af steder, lifter og pister. Søgningen ser bort fra accenter ("medran"
  finder Médran) og forstår kategoriord som "hotels", "pizza" og "toilets".
- **Steder som liste** - "Restaurants" og "Après-ski" åbner en liste med nærmeste først og
  "Open now", hvor åbningstiderne kendes. Listen kan filtreres til det, man kan nå uden ski
  eller kun på blå pister.
- **Map** - interaktivt kort over Verbier med ægte geodata fra OpenStreetMap/OpenSkiMap:
  47 lifter, 144 km pister (farvet efter rigtig sværhedsgrad), 322 steder
  (restauranter/caféer/après-ski/hoteller/ski rental) og 20 offentlige toiletter.
  Kortet fylder hele skærmen; søgefelt, filtre og knapper ligger oven på det.
  Baggrunden er et snedækket terrænkort i hele verden (hvidt relief med højdekurver og veje
  fra EOX), med telefonens eget kort nedenunder som reserve og til stednavne; en knap skifter
  til satellit. I Schweiz lægges swisstopos skarpere terrænskygge ovenpå.
  Stregtykkelse og detaljer følger zoom: på afstand er steder små prikker, tæt på får de
  ikoner, og lifter og pister får navne. Et tryk på et sted, en lift, en pist, en ven eller
  et toilet viser ét info-kort nederst med handlinger (rute, detaljer, gem); et tryk på
  tomt kort lukker det. Signaturforklaringen ligger bag en knap.
- **Rutefinding** - "Route"/"Route here" beregner den hurtigste vej via lifter og pister
  til et sted, en lift, en ven eller et toilet: vælg startpunkt (din position eller en
  liftstation) og niveau - uden ski, blå, rød, sort eller off-piste - og få en
  trin-for-trin-rute, som også kan vises på kortet. Niveauet huskes. Detaljesiden for et
  sted fortæller, hvor svært det er at komme derhen ("Needs a red piste").
- **Friends** - venneliste (eksempeldata, da appen ikke har login endnu). Vennerne vises på
  kortet, og afstanden til dem regnes ud fra din egen position.
- **Partners** - rabatter hos lokale partnere, filtrérbart efter kategori. Tilbuddene er
  eksempler - der er ingen rigtige aftaler endnu, og det står også i appen.
- **Profile** - demo-profil, skiniveau og **gemte steder** (rigtige, se nedenfor).

## Skift af skiområde

Øverst på Explore (og under Profile) vælger man skiområde.

- **Klar i appen:** Verbier plus ti områder, der er hentet på forhånd og lagt ind som filer
  i `data/resorts/`: Val Thorens-Orelle, Alpe d'Huez, Zermatt-Cervinia, Ischgl/Samnaun,
  Sölden, Åre, Hemsedal, Trysil, Whistler Blackcomb og Niseko United. De virker med det
  samme og uden net.
- **Alle andre:** Søgefeltet finder skiområder i hele verden via OpenSkiMap. Første gang man
  vælger et, henter appen lifter, pister, steder og toiletter fra OpenStreetMap (Overpass API)
  og højder fra Open-Meteo - typisk 30-60 sekunder - og gemmer området på telefonen, så det
  virker uden net bagefter (`utils/resortData.js`, `utils/resortStore.js`).

Pistefarverne følger landet: blå/rød/sort i Europa, grøn/blå/sort i Nordamerika og
grøn/rød/sort i Japan (`utils/pistes.js`).

Kun Verbier har håndlavet indhold: de fem udvalgte steder og eksempel-partnerne. I andre
områder viser Explore de bedst beskrevne spisesteder, eksempel-vennerne stilles ved rigtige
steder i området, og Partners-fanen siger, at tilbuddene kun findes for Verbier.

De gratis servere har grænser: Overpass er til tider overbelastet (så fejler hentningen, og
man må prøve igen), og Open-Meteo tillader ca. 5.000 højdeopslag i timen pr. forbindelse -
nok til 5-10 områder. Meget store sammenhængende områder (over 16 km i radius) hentes ikke.

## Sådan virker rutefindingen

`utils/routing.js` bygger en graf af lift- og pistedataene: hvert punkt på en pist og hver
liftstation er en knude. Pister kan kun køres nedad, lifter kun opad (gondoler, kabelbaner og
kombinerede lifter også ned - de er også de eneste, man kan tage uden ski), og liftstationer/pist-ender tæt på hinanden forbindes med korte gå-stykker.
Derefter finder Dijkstras algoritme den hurtigste vej. Tiderne er skøn ud fra typiske
ski- og lifthastigheder, og appen ved ikke, om en lift eller pist er åben i dag.

## Rigtige datakilder (ikke hardcoded)

- **Vejr:** Live data fra [Open-Meteo](https://open-meteo.com) for skiområdets landsby
  (temperatur, snedybde, snefald, 6-dages udsigt). Hentes, når Explore-fanen åbnes, og
  igen når man vender tilbage til den, hvis tallene er over 10 minutter gamle.
- **Gemte steder:** Brugeren kan trykke på hjerte-ikonet på et steds detaljeside for at
  gemme det. Gemte steder gemmes lokalt med `AsyncStorage` og huskes, selv efter appen
  lukkes og genåbnes (se `context/SavedPlacesContext.js`).
- **Position:** Brugerens GPS-position via `expo-location` (se `context/LocationContext.js`).
- **Kort-/stedsdata:** For Verbier er lifter, pister, steder og toiletter hentet fra
  OpenStreetMap og OpenSkiMap.org's åbne datasæt under research-fasen af projektet. Andre
  skiområder hentes af appen selv fra de samme kilder. Steder og toiletter er
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
- Baggrundskort i hele verden: [EOX::Maps](https://maps.eox.at) "Terrain Light"
  { Data © OpenStreetMap contributors and others, Rendering © EOX }. Gratis og uden
  API-nøgle; EOX beder om kildeangivelse og et link tilbage, og serveren er "best effort".
- Baggrundskort i Schweiz: terrænskygge fra Federal Office of Topography
  [©swisstopo](https://www.swisstopo.admin.ch/en/terms-of-use-free-geodata-and-geoservices):
  gratis og uden API-nøgle, men med en fair use-grænse.
- Nederst ligger Apple Maps (iOS) eller Google Maps (Android), som krediteres af kortet selv.
- Vejr- og højdedata fra [Open-Meteo](https://open-meteo.com) (CC BY 4.0).

Alle krediteres også inde i appen (under kortet, med links ved tryk, og på vejrsiden).

## Tech stack

- Expo (React Native), React Navigation (bund-navigation med 5 faner + stack-navigation
  til detaljesider ovenpå)
- `react-native-maps` til det interaktive kort
- `expo-location` til brugerens position
- `@react-native-async-storage/async-storage` til lokal, persistent lagring
- `@expo/vector-icons` til ikoner

## Mappestruktur

- `screens/` - én fil pr. skærm
- `context/` - delt tilstand: valgt skiområde, gemte steder, position og aktiv rute
- `utils/` - ren logik uden UI: rutefinding, søgning, afstande, åbningstider, links, oprydning
  i data, hentning og lagring af skiområder. `utils/resortModel.js` samler alt, appen ved om
  det valgte område
- `data/` - Verbiers geodata, steder og eksempeldata; `data/resorts/` de indbyggede skiområder
- `styles/styles.js` - fælles farver og styles; designreglerne står øverst i filen

## Kom i gang

```bash
npm install
npx expo start
```

## Tests

`npm test` kører knap 700 automatiske tests på 10-15 sekunder (Jest med `jest-expo`) - uden
net og uden telefon. De dækker den rene logik i `utils/` og `data/weather.js`: rutefinding
(i alle 11 indbyggede skiområder, fra hovedliften til hvert sted på hvert niveau), søgning,
åbningstider, pistefarver pr. land, lagring af hentede områder og hentning fra
OpenStreetMap/Open-Meteo med efterlignede svar (`__tests__/fixtures/`). Skærmene, kortet,
`context/` og alt, der kræver en telefon (GPS, rigtige netværkskald), er ikke dækket. En test
skrevet som `test.failing` beskriver en kendt fejl: når fejlen rettes, laves den om til `test`.

Demovideo: https://youtube.com/shorts/dreyhnMPcoo?is=fh6kMi-d8DRQtNp1
