import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Luft i bunden af en skærm, der ikke har fanebjælken under sig.
//
// På Android med de tre navigationsknapper (og på iPhones med
// hjem-stregen) går skærmen helt ned bag systemets bjælke. Uden ekstra
// luft ender det sidste indhold - eller en "Undo"-knap - under bjælken.
// `base` er den luft, skærmen ellers ville have.
export function useBottomSpace(base = 40) {
  const { bottom } = useSafeAreaInsets();
  return Math.max(base, bottom + 16);
}
