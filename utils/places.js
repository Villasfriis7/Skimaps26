// Små hjælpere om steder, der ikke afhænger af, hvilket skiområde der er valgt.
// Alt, der slår op i et skiområdes data (alle steder, nærmeste lift ...),
// ligger i utils/resortModel.js.

// Ældre gemte steder kan have feltet `type` i stedet for `category`.
export const placeCategory = (place) => place.category || place.type;

// "kebab;tacos" (OSM-format) -> "Kebab, tacos"
export function formatCuisine(cuisine) {
  if (!cuisine) return null;
  const text = cuisine
    .split(';')
    .map((part) => part.trim().replace(/_/g, ' '))
    .filter(Boolean)
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
