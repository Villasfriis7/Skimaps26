import { Alert, Linking, Platform } from 'react-native';

// OSM-data er ikke ensartede: nogle hjemmesider står som "www.eksempel.ch"
// uden "https://", og telefonnumre har mellemrum. Begge dele får
// Linking.openURL til at fejle, så vi retter dem til, før vi åbner dem.

export function websiteUrl(website) {
  if (!website) return null;
  const trimmed = website.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function phoneUrl(phone) {
  if (!phone) return null;
  // Behold kun cifre og et evt. indledende "+". Ved flere numre bruges det første.
  const first = phone.split(/[;,/]/)[0];
  // "+81 (0)136-23-1432": nullet i parentes bruges kun inden for landet og
  // skal ikke med, når nummeret har landekode.
  const international = /^\s*\+/.test(first) ? first.replace(/\(\s*0\s*\)/, '') : first;
  const digits = international.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

// Åbner et link og viser en forståelig besked, hvis enheden ikke kan åbne det
// (fx "tel:" i en simulator) i stedet for at fejle i stilhed.
export async function openLink(url, failMessage = 'This link could not be opened on your device.') {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open link', failMessage);
  }
}

// Link til et sted på et kort, der virker hos alle - også når modtageren af
// en delt besked har en anden slags telefon end afsenderen.
export function mapsLink(place) {
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

// Gå-rute til et sted i telefonens egen kort-app. Vores egne "gå-stykker" er
// en lige streg; kort-appen kender gaderne.
export function walkingLink(place) {
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?daddr=${place.latitude},${place.longitude}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=walking`;
}

// En websøgning efter stedets åbningstider - til de mange steder, hvor
// OpenStreetMap ikke har dem.
export function hoursSearchLink(place, resortName) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${place.name} ${resortName} opening hours`)}`;
}
