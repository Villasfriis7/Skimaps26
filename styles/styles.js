import { StyleSheet } from 'react-native';

// DESIGNREGLER (hold dig til dem, så skærmene bliver ved med at ligne hinanden)
//
//   Afstande:   4, 8, 12, 16, 20, 24, 32. Skærmmargin 20, luft i kort 16.
//   Skrift:     28/800 skærmtitel · 22/700 navn på et sted · 17/700 afsnit ·
//               16/600 række · 15 brødtekst · 13 sekundær tekst · 11-12 mærkater
//   Hjørner:    12 på knapper og ikon-felter, 16 på kort, helt runde på chips
//   Skygge:     kun på kort, der ligger på den lyseblå baggrund, og på det,
//               der svæver over kortet. Aldrig på noget inde i et kort.
//   Flader:     lyseblå (ice) er siden, hvid er et kort, `fill` er en
//               sekundær knap. Aldrig hvidt på hvidt.
//   Farver:     navy til handlinger · pistfarver KUN til pister · `route` KUN
//               til den aktive rute · én grøn (open) og én rød (danger)
//   Ikoner:     kun Ionicons - ingen emojis i brugerfladen.
//   Knapper:    én primær (navy) pr. skærm; resten er sekundære (`fill`).
//   Lister:     rækker ligger samlet i ét hvidt kort med tynde streger imellem.
//   Kontrast:   al tekst mindst 4,5:1 - appen bruges i sollys.

// Farvepalette - vinter/skitema.
export const colors = {
  deep: '#0d3b5c',
  primary: '#1b4965',
  accent: '#3fa7d6', // kun til markering af det valgte
  ice: '#eaf6ff',
  iceLight: '#f4faff',
  fill: '#dbeaf4', // sekundære knapper og ikon-felter
  hairline: '#e3edf3',
  border: '#d3e3ee',
  white: '#ffffff',
  textDark: '#1b2a33',
  textMuted: '#4a6b79',
  // Stedkategorier - mørke nok til hvide ikoner i kortets markører.
  restaurant: '#c2410c',
  cafe: '#9a6200',
  apres: '#7d3c98',
  hotel: '#4f6f94',
  route: '#d81b60', // aktiv rute på kortet - må ikke ligne en pistfarve
  sled: '#8e44ad', // kælkebane
  open: '#17734a',
  danger: '#c0392b', // lukket, rabat-mærker, gemt-hjerte
  closed: '#c0392b',
  saved: '#c0392b',
};

// Kort på den lyseblå baggrund.
const cardShadow = {
  shadowColor: '#0d3b5c',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
};

// Det, der svæver over kortet (knapper, søgefelt, info-kort): tydeligere
// skygge, ellers ser det fladt ud mod terrænet.
const floatShadow = {
  shadowColor: '#0d3b5c',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.18,
  shadowRadius: 10,
  elevation: 5,
};

// Fælles styles for hele appen - genbruges på tværs af alle skærme.
export const styles = StyleSheet.create({
  // --- Skærme -----------------------------------------------------------------
  // Detaljesider (i stack'en): en ScrollView med luft hele vejen rundt.
  screen: {
    flex: 1,
    backgroundColor: colors.ice,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // De fem faner: ingen luft i bunden, så lister går helt ned til fanebjælken.
  tabScreen: {
    flex: 1,
    backgroundColor: colors.ice,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  // Lodrette lister: listen går helt ud til skærmkanten (negativ margin), og
  // luften ligger i indholdet. Ellers skærer listens kant kortenes skygger af.
  listBleed: {
    marginHorizontal: -20,
  },
  listBleedContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ice,
  },

  // --- Tekst ------------------------------------------------------------------
  screenHeader: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  sectionLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    paddingVertical: 8,
  },
  mutedText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 8,
  },
  footnoteLink: {
    textDecorationLine: 'underline',
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 12,
  },
  // Lille mærkat: "Demo", "Soon".
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.fill,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // --- Kort og lister ---------------------------------------------------------
  card: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  cardText: {
    fontSize: 15,
    color: colors.textDark,
    lineHeight: 21,
    marginBottom: 12,
  },
  cardTextLast: {
    fontSize: 15,
    color: colors.textDark,
    lineHeight: 21,
  },
  // Ét hvidt kort med flere rækker i.
  group: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  // Tynd streg mellem to rækker, rykket ind til tekstens venstrekant.
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  rowTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 8,
  },
  rowChevron: {
    marginLeft: 6,
  },
  // Knap i højre side af en række (fx hjertet på Saved places): 44 pt trykflade.
  rowAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dimmed: {
    opacity: 0.55,
  },

  // --- Knapper og chips -------------------------------------------------------
  button: {
    backgroundColor: colors.primary,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: colors.fill,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  // En række af lige brede sekundære knapper med ikon over tekst.
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginTop: 6,
  },
  actionTile: {
    flex: 1,
    minHeight: 64,
    backgroundColor: colors.fill,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 4,
  },
  actionTileLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  smallButton: {
    minHeight: 44,
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  // Chips inde i et hvidt kort: lyseblå, så de ikke forsvinder i kortet.
  chipOnCard: {
    backgroundColor: colors.ice,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginLeft: 6,
  },
  chipTextActive: {
    color: colors.white,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  // Vandret række af chips, der går helt ud til skærmkanten.
  chipsRow: {
    flexGrow: 0,
    marginHorizontal: -20,
    marginBottom: 12,
  },
  chipsContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 2,
  },

  // --- Explore ----------------------------------------------------------------
  exploreContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 14,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: 6,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...cardShadow,
  },
  heroTitle: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
  },
  // Områdets navn er en knap, der åbner resort-vælgeren.
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroChange: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  heroChangeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.86)',
    marginTop: 2,
  },
  heroWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  heroWeatherText: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    marginBottom: 20,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: colors.textDark,
    paddingVertical: 12,
  },
  searchClear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
  },
  // Fire lige brede genveje, der flugter med resten af siden.
  // Tre genveje pr. række: plads til "Restaurants" ved stor tekst.
  tilesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 14,
  },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 76,
    marginBottom: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    marginHorizontal: 5,
    ...cardShadow,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'center',
    marginTop: 6,
  },
  // Vandrette lister: går helt ud til skærmkanten og har luft omkring
  // kortene, så skyggerne ikke bliver skåret af.
  hScroll: {
    flexGrow: 0,
    marginHorizontal: -20,
    marginBottom: 12,
  },
  hScrollContent: {
    alignItems: 'stretch',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 16,
  },
  featuredCard: {
    width: 176,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    ...cardShadow,
  },
  featuredTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  featuredSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  partnerMini: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    ...cardShadow,
  },
  discountTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  discountTileNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  discountTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.86)',
    marginTop: -2,
  },

  // --- Detaljeside for et sted ------------------------------------------------
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailTile: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
  },
  detailMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  openNow: {
    color: colors.open,
    fontWeight: '700',
  },
  closedNow: {
    color: colors.danger,
    fontWeight: '700',
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...cardShadow,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  infoIcon: {
    width: 28,
    marginTop: 1,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textDark,
    flexShrink: 1,
  },
  infoTextMuted: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    flexShrink: 1,
  },
  infoLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },

  // --- Rute -------------------------------------------------------------------
  routeDestination: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  routeHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 8,
  },
  routePicker: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  routePickerInput: {
    backgroundColor: colors.ice,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: 16,
    color: colors.textDark,
  },
  routePickerList: {
    maxHeight: 264,
    marginTop: 4,
  },
  routePickerRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  routePickerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  routePickerType: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  skillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  routeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  routeSummaryTime: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 10,
  },
  routeSummaryMeta: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Trinene som en tidslinje: ikonerne står i en søjle med en streg imellem.
  step: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  stepRail: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  stepConnector: {
    flex: 1,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  stepConnectorHidden: {
    backgroundColor: 'transparent',
  },
  stepIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: {
    flex: 1,
    paddingTop: 3,
    paddingBottom: 14,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  stepTime: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 8,
    paddingTop: 4,
  },

  // --- Vejr -------------------------------------------------------------------
  weatherHero: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...cardShadow,
  },
  weatherHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherTemp: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.white,
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    ...cardShadow,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  forecastHigh: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
  },
  forecastLow: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },

  // --- Venner -----------------------------------------------------------------
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.open,
    borderWidth: 2,
    borderColor: colors.white,
  },

  // --- Partnere ---------------------------------------------------------------
  partnerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  partnerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerDescription: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textDark,
    marginTop: 12,
  },
  partnerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  partnerLocation: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 4,
    flexShrink: 1,
  },
  partnerActions: {
    flexDirection: 'row',
    marginTop: 12,
  },

  // --- Profil -----------------------------------------------------------------
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
  },

  // --- Fortryd-bjælke (Saved places) -----------------------------------------
  undoBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textDark,
    borderRadius: 12,
    paddingLeft: 16,
    minHeight: 52,
    ...floatShadow,
  },
  undoBarText: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
  },
  undoBarButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  undoBarButtonText: {
    color: '#9fd6f2',
    fontSize: 15,
    fontWeight: '700',
  },

  // --- Kortet -----------------------------------------------------------------
  mapScreen: {
    flex: 1,
    backgroundColor: colors.ice,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
    backgroundColor: colors.iceLight,
  },
  // Søgefelt, filtre og signaturforklaring oven på kortets øverste del.
  mapTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  mapSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    marginHorizontal: 12,
    ...floatShadow,
  },
  mapSearchResults: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 8,
    maxHeight: 360,
    paddingVertical: 4,
    ...floatShadow,
  },
  mapSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  mapSearchRowIcon: {
    width: 32,
  },
  mapSearchRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  mapSearchRowSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  mapSearchEmpty: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mapChipsRow: {
    flexGrow: 0,
    marginTop: 8,
  },
  mapChipsContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  chipFloating: {
    borderWidth: 0,
    ...floatShadow,
  },
  legendCard: {
    alignSelf: 'flex-end',
    width: 232,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    marginRight: 68,
    ...floatShadow,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },
  legendSwatchWrap: {
    width: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  legendSwatch: {
    width: 30,
    height: 5,
    borderRadius: 2.5,
  },
  legendSwatchLift: {
    height: 2,
  },
  legendStation: {
    position: 'absolute',
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#2b3a42',
  },
  legendDash: {
    width: 7,
    height: 4,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '500',
  },
  legendFootnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 8,
  },
  // Knapper og info-kort oven på kortets nederste del.
  mapBottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  mapButtons: {
    alignSelf: 'flex-end',
  },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    ...floatShadow,
  },
  mapButtonActive: {
    backgroundColor: colors.primary,
  },
  mapCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    marginTop: 10,
    ...floatShadow,
  },
  mapCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mapCardIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  mapCardText: {
    flex: 1,
    paddingTop: 1,
  },
  mapCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  mapCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  mapCardClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  // "Now / Then" på rutekortet.
  mapCardSteps: {
    marginTop: 10,
    paddingTop: 8,
    paddingRight: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mapCardStep: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 26,
  },
  mapCardStepLabel: {
    width: 40,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  mapCardStepIcon: {
    width: 22,
    textAlign: 'center',
    marginRight: 6,
  },
  mapCardStepTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDark,
  },
  mapCardStepTitleNext: {
    fontWeight: '500',
  },
  mapCardStepDetail: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
  },
  mapCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingRight: 8,
  },
  mapCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: colors.fill,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  mapCardButtonPrimary: {
    backgroundColor: colors.primary,
  },
  mapCardButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  mapCardButtonTextPrimary: {
    color: colors.white,
  },
  mapCardIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapAttribution: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  // Luften under bynavnet løfter det fri af markørerne i byen.
  townLabelWrap: {
    paddingBottom: 14,
  },
  townLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.deep,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textShadowColor: '#fff',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  liftLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2b3a42',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pisteLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pisteLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  pisteLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDark,
  },
  // Gennemsigtig ramme om en markør: det er rammen, der er trykfladen, så
  // den er større end selve prikken (44 pt, eller 30 pt for de små prikker).
  markerHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerHitSmall: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDotSelected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
  },
  // Samme sted, set på afstand: bare en lille farvet prik.
  placeDotSmall: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  // Flere steder samlet i én markør med antallet i. Navy og ikke en
  // kategorifarve: en klynge blander kategorier, og et tryk er en handling
  // (zoom ind). Hvid tekst på navy er ca. 9,6:1.
  clusterMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fra 10 og op: lidt større, så to cifre og "99+" har plads.
  clusterMarkerLarge: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  clusterMarkerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false, // Android: ellers står tallet for lavt
  },
  // I oversigten (de enkelte steder er små prikker).
  clusterMarkerSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  clusterMarkerTextSmall: {
    fontSize: 11,
  },
  // Mørk prik med hvid kant - liftstationerne er hvide med mørk kant, så de
  // to må ikke ligne hinanden.
  toiletDotSmall: {
    backgroundColor: colors.primary,
  },
  toiletMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toiletMarkerText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    includeFontPadding: false,
  },
  friendMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendMarkerText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  friendMarkerSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  friendMarkerTextSmall: {
    fontSize: 10,
  },
  // Brugerens egen position: blå prik i en lys ring, over alle andre markører.
  youHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(21,101,192,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1565c0',
    borderWidth: 3,
    borderColor: colors.white,
  },
  // Ring om den valgte markør.
  focusRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(63,167,214,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStartDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.route,
  },
});
