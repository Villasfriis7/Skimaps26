// Hjælpere til tests af den kode, der henter data fra nettet.
//
// Testene må ALDRIG ramme de rigtige servere (Open-Meteo, Overpass og
// OpenSkiMap har alle grænser for, hvor meget man må hente). I stedet
// erstattes global.fetch med en funktion, vi selv bestemmer svaret fra.

// Et svar, der ligner det, fetch() giver: { ok, status, json() }.
export const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

// Et kald, der aldrig svarer - en server, der "hænger". Det afbrydes ligesom
// et rigtigt fetch(), når koden kalder AbortController.abort().
export function hanging(options = {}) {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    const abort = () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (!signal) return;
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort);
  });
}

// Et kald, testen selv afslutter senere med resolve()/reject().
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Sætter global.fetch til `handler(url, options)`. Handleren returnerer et
// svar (eller et løfte om et), eller kaster en fejl for "intet net".
// Returnerer jest-mock'en, så testen kan se, hvilke kald der blev lavet.
export function installFetch(handler) {
  global.fetch = jest.fn((url, options = {}) => {
    try {
      return Promise.resolve(handler(String(url), options));
    } catch (error) {
      return Promise.reject(error);
    }
  });
  return global.fetch;
}

// Alle de adresser, fetch er blevet kaldt med (evt. kun dem, der indeholder `part`).
export const calledUrls = (fetchMock, part = '') =>
  fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(part));

// Med jests falske ur står tiden stille, indtil testen selv skruer den frem.
// Denne hjælper skruer frem ét sekund ad gangen, til løftet er afgjort, og
// returnerer { value } eller { error } - så ventetider på op til flere
// minutter i koden (timeouts, pauser mellem kald) tager ingen rigtig tid.
export async function settle(promise, maxSeconds = 600) {
  let outcome = null;
  promise.then(
    (value) => {
      outcome = { value };
    },
    (error) => {
      outcome = { error };
    }
  );
  for (let i = 0; i < maxSeconds && !outcome; i++) {
    await jest.advanceTimersByTimeAsync(1000);
  }
  if (!outcome) throw new Error(`Løftet blev ikke afgjort inden for ${maxSeconds} (falske) sekunder`);
  return outcome;
}
