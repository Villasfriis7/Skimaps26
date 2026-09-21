import { StyleSheet } from 'react-native';

// Farvepalette - vinter/skitema.
export const colors = {
  deep: '#0d3b5c',
  primary: '#1b4965',
  accent: '#3fa7d6',
  ice: '#eaf6ff',
  iceLight: '#f4faff',
  white: '#ffffff',
  textDark: '#1b2a33',
  textMuted: '#5a7d8c',
  cafe: '#e8a33d',
  restaurant: '#e5673f',
};

const cardShadow = {
  shadowColor: '#0d3b5c',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 10,
  elevation: 3,
};

// Fælles styles for hele appen - genbruges på tværs af alle skærme.
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ice,
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Home screen ---
  homeGradient: {
    flex: 1,
  },
  homeContent: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoEmoji: {
    fontSize: 46,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 42,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
    ...cardShadow,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  primaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  secondaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Generic titles/buttons (still used where needed) ---
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 30,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
    ...cardShadow,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Map screen ---
  screenHeader: {
    marginBottom: 14,
  },
  screenHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  screenHeaderSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#cfe8f5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    marginVertical: 4,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    ...cardShadow,
  },
  map: {
    flex: 1,
    backgroundColor: colors.iceLight,
  },
  townLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    textShadowColor: '#fff',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  calloutContainer: {
    minWidth: 160,
    padding: 4,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  calloutSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  legendCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    ...cardShadow,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 3,
  },
  legendSwatch: {
    width: 14,
    height: 4,
    borderRadius: 2,
    marginRight: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: colors.textDark,
    fontWeight: '500',
  },

  // --- POI list ---
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  listItemIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listItemIcon: {
    fontSize: 24,
  },
  listItemTextWrap: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  listItemSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
  },
  listItemChevron: {
    fontSize: 22,
    color: '#c7d8e0',
    marginLeft: 6,
  },

  // --- POI detail ---
  detailIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  detailIconEmoji: {
    fontSize: 34,
  },
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
    ...cardShadow,
  },
  cardText: {
    fontSize: 16,
    color: colors.textDark,
    marginBottom: 12,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoRowIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoRowText: {
    fontSize: 15,
    color: colors.textDark,
    flexShrink: 1,
  },
  badge: {
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 14,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
