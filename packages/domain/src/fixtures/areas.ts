import type { AmenityClass, BuildingType, Location, NeighbourhoodHierarchy } from '../types';

/** A street the fixture town generates Houses along. Offsets are metres from the area centre. */
export interface FixtureStreet {
  name: string;
  postcode: string;
  /** Start of the street relative to the area centre (east, north). */
  start: readonly [number, number];
  /** Compass bearing in degrees the street runs along. */
  bearingDegrees: number;
  /** Number of Houses to place along it. */
  houses: number;
  /** House number the street starts counting at. */
  firstNumber: number;
}

interface FixtureAmenity {
  class: AmenityClass;
  name: string;
  /** Metres from the area centre (east, north). */
  offset: readonly [number, number];
}

export interface FixtureArea {
  key: string;
  centre: Location;
  name: string;
  hierarchy: NeighbourhoodHierarchy;
  city: string;
  /** ISO 4217 code of the area's price register, or `null` when the region has no open price data. */
  currency: string | null;
  priceRegister: string | null;
  /** Typical price band for a house of each building type, in `currency`. */
  priceBands: Record<BuildingType, readonly [number, number]>;
  buildingTypeWeights: ReadonlyArray<readonly [BuildingType, number]>;
  streets: readonly FixtureStreet[];
  amenities: readonly FixtureAmenity[];
  /** First OSM-shaped id number; Houses count up from here. */
  firstOsmId: number;
  seed: number;
}

/** The fixture town with prices. */
export const AMSTERDAM_CENTRE: Location = { lat: 52.3676, lng: 4.9041 };

/** The fixture area without open price data. */
export const SYDNEY_CENTRE: Location = { lat: -33.8688, lng: 151.2093 };

const AMSTERDAM_AREA: FixtureArea = {
  key: 'amsterdam',
  centre: AMSTERDAM_CENTRE,
  name: 'Grachtengordel-Zuid',
  hierarchy: {
    suburb: 'Grachtengordel-Zuid',
    city: 'Amsterdam',
    region: 'Noord-Holland',
    country: 'Nederland',
    countryCode: 'NL',
  },
  city: 'Amsterdam',
  currency: 'EUR',
  priceRegister: 'fixture:kadaster',
  priceBands: {
    apartments: [325_000, 690_000],
    terraced: [540_000, 1_150_000],
    house: [620_000, 1_400_000],
    'semi-detached': [700_000, 1_250_000],
    detached: [950_000, 1_950_000],
    residential: [380_000, 760_000],
    other: [300_000, 650_000],
  },
  buildingTypeWeights: [
    ['apartments', 46],
    ['terraced', 28],
    ['house', 10],
    ['residential', 8],
    ['semi-detached', 4],
    ['detached', 2],
    ['other', 2],
  ],
  streets: [
    {
      name: 'Prinsengracht',
      postcode: '1017 KT',
      start: [-380, 260],
      bearingDegrees: 118,
      houses: 18,
      firstNumber: 651,
    },
    {
      name: 'Keizersgracht',
      postcode: '1017 DZ',
      start: [-330, 330],
      bearingDegrees: 118,
      houses: 16,
      firstNumber: 601,
    },
    {
      name: 'Herengracht',
      postcode: '1017 BS',
      start: [-290, 400],
      bearingDegrees: 118,
      houses: 14,
      firstNumber: 551,
    },
    {
      name: 'Reguliersgracht',
      postcode: '1017 LP',
      start: [40, 380],
      bearingDegrees: 190,
      houses: 12,
      firstNumber: 10,
    },
    {
      name: 'Utrechtsestraat',
      postcode: '1017 VM',
      start: [-40, 330],
      bearingDegrees: 178,
      houses: 14,
      firstNumber: 30,
    },
    {
      name: 'Kerkstraat',
      postcode: '1017 GN',
      start: [-360, 150],
      bearingDegrees: 118,
      houses: 14,
      firstNumber: 300,
    },
    {
      name: 'Nieuwe Prinsengracht',
      postcode: '1018 EA',
      start: [140, -20],
      bearingDegrees: 88,
      houses: 10,
      firstNumber: 1,
    },
    {
      name: 'Sarphatistraat',
      postcode: '1018 GV',
      start: [60, -170],
      bearingDegrees: 62,
      houses: 10,
      firstNumber: 21,
    },
    {
      name: 'Weesperstraat',
      postcode: '1018 DN',
      start: [220, 160],
      bearingDegrees: 160,
      houses: 6,
      firstNumber: 50,
    },
    {
      name: 'Amstel',
      postcode: '1017 AB',
      start: [-120, -60],
      bearingDegrees: 150,
      houses: 8,
      firstNumber: 140,
    },
  ],
  amenities: [
    { class: 'school', name: 'Barlaeus Gymnasium', offset: [-980, 240] },
    { class: 'school', name: 'Basisschool De Kleine Reus', offset: [-300, -520] },
    { class: 'supermarket', name: 'Albert Heijn Vijzelstraat', offset: [-330, 170] },
    { class: 'supermarket', name: 'Marqt Utrechtsestraat', offset: [-40, 100] },
    { class: 'healthcare', name: 'Huisartsenpraktijk Amstel', offset: [-150, -110] },
    { class: 'healthcare', name: 'Apotheek Frederiksplein', offset: [-140, -260] },
    { class: 'park', name: 'Wertheimpark', offset: [560, 120] },
    { class: 'park', name: 'Sarphatipark', offset: [-330, -1010] },
    { class: 'transport', name: 'Metro Vijzelgracht', offset: [-390, -30] },
    { class: 'transport', name: 'Tramhalte Keizersgracht', offset: [-200, 340] },
    { class: 'transport', name: 'Metro Waterlooplein', offset: [420, 420] },
  ],
  firstOsmId: 900_000_001,
  seed: 20_260_917,
};

const SYDNEY_AREA: FixtureArea = {
  key: 'sydney',
  centre: SYDNEY_CENTRE,
  name: 'Sydney',
  hierarchy: {
    suburb: 'Sydney',
    city: 'Sydney',
    region: 'New South Wales',
    country: 'Australia',
    countryCode: 'AU',
  },
  city: 'Sydney',
  currency: null,
  priceRegister: null,
  priceBands: {
    apartments: [0, 0],
    terraced: [0, 0],
    house: [0, 0],
    'semi-detached': [0, 0],
    detached: [0, 0],
    residential: [0, 0],
    other: [0, 0],
  },
  buildingTypeWeights: [
    ['apartments', 62],
    ['terraced', 18],
    ['residential', 10],
    ['house', 6],
    ['other', 4],
  ],
  streets: [
    {
      name: 'George Street',
      postcode: '2000',
      start: [-140, 360],
      bearingDegrees: 190,
      houses: 12,
      firstNumber: 401,
    },
    {
      name: 'Pitt Street',
      postcode: '2000',
      start: [-40, 330],
      bearingDegrees: 190,
      houses: 12,
      firstNumber: 201,
    },
    {
      name: 'Elizabeth Street',
      postcode: '2000',
      start: [140, 300],
      bearingDegrees: 190,
      houses: 10,
      firstNumber: 101,
    },
    {
      name: 'Park Street',
      postcode: '2000',
      start: [-220, -30],
      bearingDegrees: 100,
      houses: 8,
      firstNumber: 1,
    },
    {
      name: 'Bathurst Street',
      postcode: '2000',
      start: [-250, -190],
      bearingDegrees: 100,
      houses: 8,
      firstNumber: 20,
    },
    {
      name: 'Kent Street',
      postcode: '2000',
      start: [-360, 260],
      bearingDegrees: 190,
      houses: 8,
      firstNumber: 300,
    },
  ],
  amenities: [
    { class: 'school', name: 'Sydney Grammar School', offset: [420, -340] },
    { class: 'supermarket', name: 'Woolworths Metro Town Hall', offset: [-110, -60] },
    { class: 'healthcare', name: 'Sydney Hospital', offset: [430, 520] },
    { class: 'park', name: 'Hyde Park', offset: [330, -80] },
    { class: 'park', name: 'Royal Botanic Garden', offset: [700, 900] },
    { class: 'transport', name: 'Town Hall Station', offset: [-120, -20] },
    { class: 'transport', name: 'St James Station', offset: [280, 220] },
  ],
  firstOsmId: 910_000_001,
  seed: 20_260_918,
};

export const FIXTURE_AREAS: readonly FixtureArea[] = [AMSTERDAM_AREA, SYDNEY_AREA];
