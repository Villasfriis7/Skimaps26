import { placeCategory, formatCuisine } from '../utils/places';

describe('placeCategory', () => {
  test('bruger category', () => {
    expect(placeCategory({ category: 'hotel' })).toBe('hotel');
  });

  test('ældre gemte steder har type i stedet', () => {
    expect(placeCategory({ type: 'restaurant' })).toBe('restaurant');
  });

  test('category vinder, hvis begge findes', () => {
    expect(placeCategory({ category: 'cafe', type: 'restaurant' })).toBe('cafe');
  });
});

describe('formatCuisine', () => {
  test.each([
    ['kebab;tacos', 'Kebab, tacos'],
    ['ice_cream;pasta;pizza', 'Ice cream, pasta, pizza'],
    ['regional', 'Regional'],
    [' burger ; pizza ', 'Burger, pizza'],
    ['pizza;', 'Pizza'],
  ])('"%s" -> "%s"', (osm, text) => {
    expect(formatCuisine(osm)).toBe(text);
  });

  test('ingen køkkentype giver null', () => {
    expect(formatCuisine(null)).toBeNull();
    expect(formatCuisine(undefined)).toBeNull();
    expect(formatCuisine('')).toBeNull();
  });
});
