import { Alert, Linking } from 'react-native';

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
  const digits = first.replace(/[^\d+]/g, '');
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
