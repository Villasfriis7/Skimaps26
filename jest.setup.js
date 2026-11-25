// Fælles opsætning for alle tests (se "jest" i package.json).
//
// Om "modulePaths" i package.json: jest-expo skal bruge pakken
// expo-modules-core, og i dette projekts package-lock.json ligger den inde i
// node_modules/expo/node_modules/ i stedet for øverst i node_modules/. Linjen
// fortæller Jest, at der også må ledes dér. Uden den stopper alle tests med
// "Cannot find module 'expo-modules-core'".

// AsyncStorage er et native modul og findes ikke, når testene kører i Node.
// Pakken har selv en officiel erstatning, der gemmer i hukommelsen - den
// bruger vi alle steder, så utils/resortStore.js kan testes uden en telefon.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Testene skal kunne køre uden net, og de gratis servere (Open-Meteo,
// Overpass, OpenSkiMap) har grænser for, hvor meget man må hente. Derfor
// fejler ethvert rigtigt netværkskald med det samme - en test, der har brug
// for et svar, sætter selv sit eget med installFetch() fra
// __tests__/helpers/fetchMock.js.
global.fetch = (url) => {
  throw new Error(`Tests må ikke bruge nettet (forsøgte at hente ${url}). Brug installFetch().`);
};
