import { verbier } from './verbier';
import { unpackResort } from '../../utils/resortStore';

// SKIOMRÅDER, DER LIGGER KLAR I APPEN
//
// Verbier er håndlavet (se verbier.js). De øvrige er hentet med appens egen
// kode (utils/resortData.js) og lagt ind som filer, så de virker med det
// samme og uden net. Alle andre skiområder i verden hentes, første gang man
// vælger dem i resort-vælgeren.
//
// `load` kaldes først, når området vælges, så de store filer ikke læses ved
// opstart.
export const bundledResorts = [
  { id: 'verbier', name: 'Verbier', country: 'Switzerland', load: () => verbier },
  { id: '3ab7375c4734163405f0f77a7c5a6afdfd600b73', name: "Val Thorens - Orelle", country: 'France', load: () => unpackResort(require('./val-thorens.json')) },
  { id: '19291bcc85a3b6bda5a0817e6a20bf8b8b71a5c0', name: "Whistler Blackcomb", country: 'Canada', load: () => unpackResort(require('./whistler-blackcomb.json')) },
  { id: '7c2f2690d339d9df6f820e7c6e596a9b0ba3dce5', name: "Silvretta Arena Ischgl/Samnaun", country: 'Austria', load: () => unpackResort(require('./ischgl.json')) },
  { id: '78e5f98d8527df7216b08962f372659abcd4f711', name: "Sölden", country: 'Austria', load: () => unpackResort(require('./solden.json')) },
  { id: 'fc76f378a2f19efc5228c60d97c895dde82ac2c5', name: "Zermatt - Breuil-Cervinia", country: 'Switzerland', load: () => unpackResort(require('./zermatt-cervinia.json')) },
  { id: '1164f5d49e7b6c2d5f7ae7db3943116e7e15438e', name: "Alpe d'Huez Grand Domaine", country: 'France', load: () => unpackResort(require('./alpe-dhuez.json')) },
  { id: '7467b4b92b34f135e5a3258eee64b992f39c95f0', name: "Niseko United", country: 'Japan', load: () => unpackResort(require('./niseko.json')) },
  { id: '5ea6683e3bed42670ca7fc03e9820599aee891a6', name: "Åre", country: 'Sweden', load: () => unpackResort(require('./are.json')) },
  { id: 'b354be312d77204a1cb32a67e47e2334cb41ab5f', name: "Hemsedal", country: 'Norway', load: () => unpackResort(require('./hemsedal.json')) },
  { id: '24ab41e1438aff639aa8ef5ad91c3e187e2f8585', name: "Trysil", country: 'Norway', load: () => unpackResort(require('./trysil.json')) },
];

export const bundledResort = (id) => bundledResorts.find((item) => item.id === id) || null;
