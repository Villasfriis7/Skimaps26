// Liste over cafeer og restauranter i Verbier skiområdet.
// Bruges af MapScreen (markører), POIListScreen og POIDetailScreen.
// latitude/longitude er tilnærmede placeringer nær de rigtige liftstationer
// (se data/verbierMap.js for kilden til lift-/pistedata).
export const pois = [
  {
    id: '1',
    name: 'Le Rouge',
    type: 'restaurant',
    description: 'Populær restaurant og bar lige ved Médran-liftens bundstation i Verbier by. Solterrasse og livlig stemning efter skidagen.',
    walkTime: '2 min fra Médran-liften',
    route: 'Stå af Médran-gondolen ved bundstationen i Verbier by, gå til venstre langs pladsen - Le Rouge ligger 2 min derfra.',
    latitude: 46.09330,
    longitude: 7.23410,
  },
  {
    id: '2',
    name: 'Chez Dany',
    type: 'restaurant',
    description: 'Klassisk bjergrestaurant i skoven ved Savoleyres, kendt for hjemmelavet mad og hyggelig atmosfære langt fra pisterne.',
    walkTime: '10 min fra Savoleyres-liften',
    route: 'Fra toppen af Savoleyres-gondolen, følg stien mod Clambin/skoven i ca. 10 min - Chez Dany ligger midt i skoven.',
    latitude: 46.10750,
    longitude: 7.22300,
  },
  {
    id: '3',
    name: 'Le Carrefour',
    type: 'cafe',
    description: 'Selvbetjeningscafé ved Attelas med udsigt over dalen. Godt stop for kaffe og en let frokost midt i pisterne.',
    walkTime: '3 min fra Attelas-liften',
    route: 'Stå af Attelas-stolelften ved topstationen og gå ligeud - Le Carrefour ligger lige ved siden af liften.',
    latitude: 46.09820,
    longitude: 7.27180,
  },
  {
    id: '4',
    name: 'Cabane du Mont-Fort',
    type: 'restaurant',
    description: 'Ikonisk bjerghytte højt til fjelds nær Mont-Fort, med panoramaudsigt til Mont Blanc og Matterhorn. Populært stop for de øvede skiløbere.',
    walkTime: '15 min fra Lac des Vaux-liften',
    route: 'Fra toppen af Lac des Vaux-stolelften, følg skiltene mod "Cabane du Mont-Fort" til fods i ca. 15 min opad.',
    latitude: 46.10150,
    longitude: 7.27400,
  },
  {
    id: '5',
    name: 'La Chaux',
    type: 'cafe',
    description: 'Solrig selvbetjeningsrestaurant i La Chaux-området, med stor terrasse og udsigt over Verbier-dalen.',
    walkTime: '5 min fra Savoleyres-liften',
    route: 'Fra toppen af Savoleyres-gondolen kør ned mod La Chaux - restauranten ligger ved siden af den røde Attelas-pist.',
    latitude: 46.11900,
    longitude: 7.22100,
  },
];
