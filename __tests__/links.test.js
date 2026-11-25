import { Alert, Linking } from 'react-native';
import { websiteUrl, phoneUrl, openLink } from '../utils/links';

describe('websiteUrl', () => {
  test('sætter https:// foran, når OpenStreetMap kun har "www..."', () => {
    expect(websiteUrl('www.alcapone-verbier.com')).toBe('https://www.alcapone-verbier.com');
    expect(websiteUrl('chezdany.ch')).toBe('https://chezdany.ch');
  });

  test('lader rigtige adresser være', () => {
    expect(websiteUrl('https://www.chezdany.ch/')).toBe('https://www.chezdany.ch/');
    expect(websiteUrl('http://example.com')).toBe('http://example.com');
    expect(websiteUrl('HTTPS://EXAMPLE.COM')).toBe('HTTPS://EXAMPLE.COM');
  });

  test('fjerner mellemrum omkring', () => {
    expect(websiteUrl('  www.example.com ')).toBe('https://www.example.com');
  });

  test('ingen hjemmeside giver null', () => {
    expect(websiteUrl(null)).toBeNull();
    expect(websiteUrl('')).toBeNull();
    expect(websiteUrl(undefined)).toBeNull();
  });
});

describe('phoneUrl', () => {
  test('fjerner mellemrum og tegn, men beholder +', () => {
    expect(phoneUrl('+41 27 771 25 24')).toBe('tel:+41277712524');
    expect(phoneUrl('+41-27-771.25.24')).toBe('tel:+41277712524');
    expect(phoneUrl('027 771 25 24')).toBe('tel:0277712524');
  });

  // "(0)" i et internationalt nummer tastes kun inden for landet (fire steder i Niseko).
  test('et "(0)" efter landekoden skal ikke med i nummeret', () => {
    expect(phoneUrl('+81 (0)136-23-1432')).toBe('tel:+81136231432');
    expect(phoneUrl('+81(0)136 555 122')).toBe('tel:+81136555122');
  });

  test('ved flere numre bruges det første', () => {
    expect(phoneUrl('+41 27 771 25 24; +41 79 000 00 00')).toBe('tel:+41277712524');
    expect(phoneUrl('+41 27 771 25 24, +41 79 000 00 00')).toBe('tel:+41277712524');
    expect(phoneUrl('+41 27 771 25 24 / +41 79 000 00 00')).toBe('tel:+41277712524');
  });

  test('intet nummer giver null', () => {
    expect(phoneUrl(null)).toBeNull();
    expect(phoneUrl('')).toBeNull();
    expect(phoneUrl('call us')).toBeNull();
  });
});

describe('openLink', () => {
  let openURL;
  let alert;

  beforeEach(() => {
    // Linking er allerede en jest-mock i testmiljøet, så tidligere kald skal
    // nulstilles mellem testene.
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('åbner linket', async () => {
    await openLink('https://www.chezdany.ch/');
    expect(openURL).toHaveBeenCalledWith('https://www.chezdany.ch/');
    expect(alert).not.toHaveBeenCalled();
  });

  test('gør ingenting uden et link', async () => {
    await openLink(null);
    expect(openURL).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  test('viser en besked i stedet for at fejle i stilhed', async () => {
    // Fx "tel:" i en simulator, der ikke kan ringe op.
    openURL.mockRejectedValue(new Error('Unable to open URL'));
    await expect(openLink('tel:+41277712524')).resolves.toBeUndefined();
    expect(alert).toHaveBeenCalledWith('Could not open link', 'This link could not be opened on your device.');
  });

  test('beskeden kan vælges', async () => {
    openURL.mockRejectedValue(new Error('Unable to open URL'));
    await openLink('tel:+41277712524', 'Calling is not available here.');
    expect(alert).toHaveBeenCalledWith('Could not open link', 'Calling is not available here.');
  });
});
