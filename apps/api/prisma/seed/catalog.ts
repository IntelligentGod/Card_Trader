import type { CardCategory } from '@prisma/client';

/**
 * Development catalog. Real product lines so the app feels realistic; card
 * numbers/rarities are best-effort and should be replaced by a licensed
 * catalog import before production. No card artwork is bundled.
 */
export interface SeedCard {
  ref: string;
  name: string;
  cardNumber: string;
  variant?: string;
  subject?: string;
  rarity?: string;
}

export interface SeedSet {
  category: CardCategory;
  code: string;
  name: string;
  year: number;
  manufacturer: string;
  cards: SeedCard[];
}

export const SEED_SETS: SeedSet[] = [
  {
    category: 'POKEMON',
    code: 'BASE1',
    name: 'Base Set',
    year: 1999,
    manufacturer: 'Wizards of the Coast',
    cards: [
      { ref: 'pkm-base-charizard', name: 'Charizard', cardNumber: '4', subject: 'Charizard', rarity: 'Holo Rare' },
      { ref: 'pkm-base-blastoise', name: 'Blastoise', cardNumber: '2', subject: 'Blastoise', rarity: 'Holo Rare' },
      { ref: 'pkm-base-venusaur', name: 'Venusaur', cardNumber: '15', subject: 'Venusaur', rarity: 'Holo Rare' },
      { ref: 'pkm-base-pikachu', name: 'Pikachu', cardNumber: '58', subject: 'Pikachu', rarity: 'Common' },
    ],
  },
  {
    category: 'POKEMON',
    code: 'SV3PT5',
    name: 'Scarlet & Violet—151',
    year: 2023,
    manufacturer: 'The Pokémon Company',
    cards: [
      { ref: 'pkm-151-charizard-ex', name: 'Charizard ex', cardNumber: '199', subject: 'Charizard', rarity: 'Special Illustration Rare' },
      { ref: 'pkm-151-pikachu', name: 'Pikachu', cardNumber: '173', subject: 'Pikachu', rarity: 'Illustration Rare' },
      { ref: 'pkm-151-mew-ex', name: 'Mew ex', cardNumber: '205', subject: 'Mew', rarity: 'Hyper Rare' },
      { ref: 'pkm-151-bulbasaur', name: 'Bulbasaur', cardNumber: '166', subject: 'Bulbasaur', rarity: 'Illustration Rare' },
      { ref: 'pkm-151-alakazam-ex', name: 'Alakazam ex', cardNumber: '201', subject: 'Alakazam', rarity: 'Special Illustration Rare' },
    ],
  },
  {
    category: 'POKEMON',
    code: 'SWSH7',
    name: 'Evolving Skies',
    year: 2021,
    manufacturer: 'The Pokémon Company',
    cards: [
      { ref: 'pkm-evs-umbreon-vmax', name: 'Umbreon VMAX', cardNumber: '215', variant: 'Alternate Art', subject: 'Umbreon', rarity: 'Secret Rare' },
      { ref: 'pkm-evs-rayquaza-vmax', name: 'Rayquaza VMAX', cardNumber: '218', variant: 'Alternate Art', subject: 'Rayquaza', rarity: 'Secret Rare' },
      { ref: 'pkm-evs-sylveon-v', name: 'Sylveon V', cardNumber: '184', variant: 'Alternate Art', subject: 'Sylveon', rarity: 'Ultra Rare' },
    ],
  },
  {
    category: 'POKEMON',
    code: 'SV4PT5',
    name: 'Paldean Fates',
    year: 2024,
    manufacturer: 'The Pokémon Company',
    cards: [
      { ref: 'pkm-paf-charizard-ex', name: 'Charizard ex', cardNumber: '234', subject: 'Charizard', rarity: 'Special Illustration Rare' },
      { ref: 'pkm-paf-mew-ex', name: 'Mew ex', cardNumber: '232', subject: 'Mew', rarity: 'Special Illustration Rare' },
    ],
  },
  {
    category: 'ONE_PIECE',
    code: 'OP01',
    name: 'Romance Dawn',
    year: 2022,
    manufacturer: 'Bandai',
    cards: [
      { ref: 'op-op01-luffy-leader', name: 'Monkey.D.Luffy', cardNumber: 'OP01-003', subject: 'Monkey.D.Luffy', rarity: 'Leader' },
      { ref: 'op-op01-zoro', name: 'Roronoa Zoro', cardNumber: 'OP01-025', subject: 'Roronoa Zoro', rarity: 'SR' },
      { ref: 'op-op01-zoro-alt', name: 'Roronoa Zoro', cardNumber: 'OP01-025', variant: 'Alternate Art', subject: 'Roronoa Zoro', rarity: 'SR' },
      { ref: 'op-op01-shanks', name: 'Shanks', cardNumber: 'OP01-120', subject: 'Shanks', rarity: 'SEC' },
      { ref: 'op-op01-law', name: 'Trafalgar Law', cardNumber: 'OP01-047', subject: 'Trafalgar Law', rarity: 'SR' },
    ],
  },
  {
    category: 'ONE_PIECE',
    code: 'OP05',
    name: 'Awakening of the New Era',
    year: 2023,
    manufacturer: 'Bandai',
    cards: [
      { ref: 'op-op05-luffy-sec', name: 'Monkey.D.Luffy', cardNumber: 'OP05-119', subject: 'Monkey.D.Luffy', rarity: 'SEC' },
      { ref: 'op-op05-luffy-manga', name: 'Monkey.D.Luffy', cardNumber: 'OP05-119', variant: 'Manga Rare', subject: 'Monkey.D.Luffy', rarity: 'SEC' },
      { ref: 'op-op05-sabo', name: 'Sabo', cardNumber: 'OP05-007', subject: 'Sabo', rarity: 'SR' },
    ],
  },
  {
    category: 'ONE_PIECE',
    code: 'ST01',
    name: 'Straw Hat Crew',
    year: 2022,
    manufacturer: 'Bandai',
    cards: [
      { ref: 'op-st01-luffy', name: 'Monkey.D.Luffy', cardNumber: 'ST01-001', subject: 'Monkey.D.Luffy', rarity: 'Leader' },
      { ref: 'op-st01-nami', name: 'Nami', cardNumber: 'ST01-007', subject: 'Nami', rarity: 'Common' },
    ],
  },
  {
    category: 'SPORTS',
    code: '1986-FLEER-BKB',
    name: '1986 Fleer Basketball',
    year: 1986,
    manufacturer: 'Fleer',
    cards: [{ ref: 'sp-86fleer-jordan', name: 'Michael Jordan', cardNumber: '57', subject: 'Michael Jordan', rarity: 'Rookie' }],
  },
  {
    category: 'SPORTS',
    code: '2003-TOPPS-CHROME-BKB',
    name: '2003 Topps Chrome Basketball',
    year: 2003,
    manufacturer: 'Topps',
    cards: [
      { ref: 'sp-03chrome-lebron', name: 'LeBron James', cardNumber: '111', subject: 'LeBron James', rarity: 'Rookie' },
      { ref: 'sp-03chrome-lebron-ref', name: 'LeBron James', cardNumber: '111', variant: 'Refractor', subject: 'LeBron James', rarity: 'Rookie' },
    ],
  },
  {
    category: 'SPORTS',
    code: '2018-PRIZM-BKB',
    name: '2018 Panini Prizm Basketball',
    year: 2018,
    manufacturer: 'Panini',
    cards: [
      { ref: 'sp-18prizm-luka', name: 'Luka Doncic', cardNumber: '280', subject: 'Luka Doncic', rarity: 'Rookie' },
      { ref: 'sp-18prizm-luka-silver', name: 'Luka Doncic', cardNumber: '280', variant: 'Silver Prizm', subject: 'Luka Doncic', rarity: 'Rookie' },
      { ref: 'sp-18prizm-trae', name: 'Trae Young', cardNumber: '78', subject: 'Trae Young', rarity: 'Rookie' },
    ],
  },
  {
    category: 'SPORTS',
    code: '2023-PRIZM-BKB',
    name: '2023 Panini Prizm Basketball',
    year: 2023,
    manufacturer: 'Panini',
    cards: [{ ref: 'sp-23prizm-wemby', name: 'Victor Wembanyama', cardNumber: '136', subject: 'Victor Wembanyama', rarity: 'Rookie' }],
  },
  {
    category: 'SPORTS',
    code: '2011-TOPPS-UPDATE-BSB',
    name: '2011 Topps Update Baseball',
    year: 2011,
    manufacturer: 'Topps',
    cards: [{ ref: 'sp-11update-trout', name: 'Mike Trout', cardNumber: 'US175', subject: 'Mike Trout', rarity: 'Rookie' }],
  },
  {
    category: 'SPORTS',
    code: '2018-TOPPS-UPDATE-BSB',
    name: '2018 Topps Update Baseball',
    year: 2018,
    manufacturer: 'Topps',
    cards: [{ ref: 'sp-18update-ohtani', name: 'Shohei Ohtani', cardNumber: 'US1', subject: 'Shohei Ohtani', rarity: 'Rookie' }],
  },
  {
    category: 'SPORTS',
    code: '2017-PRIZM-FTB',
    name: '2017 Panini Prizm Football',
    year: 2017,
    manufacturer: 'Panini',
    cards: [{ ref: 'sp-17prizm-mahomes', name: 'Patrick Mahomes', cardNumber: '269', subject: 'Patrick Mahomes', rarity: 'Rookie' }],
  },
];


export interface SeedItem {
  ref: string;
  condition: 'RAW' | 'MINT' | 'NEAR_MINT' | 'EXCELLENT' | 'GRADED';
  gradingCompany?: 'PSA' | 'BGS' | 'CGC';
  grade?: number;
  certNumber?: string;
  quantity?: number;
  listingStatus: 'PERSONAL' | 'FOR_TRADE' | 'FOR_SALE' | 'TRADE_AND_SALE';
  askingPriceCents?: number;
  purchasePriceCents?: number;
}

export interface SeedVendor {
  businessName: string;
  description: string;
  website?: string;
  socialLinks: Record<string, string>;
}

export interface SeedUser {
  email: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  socialLinks: Record<string, string>;
  vendor?: SeedVendor;
  items: SeedItem[];
}

/** Demo password for every seed account (development only). */
export const SEED_PASSWORD = 'CardShow2025!';

export const SEED_USERS: SeedUser[] = [
  {
    email: 'tom@example.com',
    username: 'tom',
    displayName: 'Tom',
    bio: 'Vintage Pokémon and basketball rookies. Always at the Sunday show.',
    location: 'Austin, TX',
    socialLinks: { instagram: '@tomcollects' },
    items: [
      { ref: 'pkm-151-pikachu', condition: 'GRADED', gradingCompany: 'PSA', grade: 10, certNumber: '81234567', listingStatus: 'FOR_TRADE', purchasePriceCents: 18000 },
      { ref: 'pkm-base-charizard', condition: 'GRADED', gradingCompany: 'PSA', grade: 8, certNumber: '45120988', listingStatus: 'PERSONAL', purchasePriceCents: 95000 },
      { ref: 'pkm-151-charizard-ex', condition: 'NEAR_MINT', quantity: 2, listingStatus: 'TRADE_AND_SALE', askingPriceCents: 125000, purchasePriceCents: 9000 },
      { ref: 'pkm-evs-umbreon-vmax', condition: 'NEAR_MINT', listingStatus: 'PERSONAL', purchasePriceCents: 110000 },
      { ref: 'pkm-base-pikachu', condition: 'EXCELLENT', quantity: 3, listingStatus: 'FOR_TRADE' },
      { ref: 'op-op01-shanks', condition: 'NEAR_MINT', listingStatus: 'FOR_TRADE', purchasePriceCents: 7000 },
      { ref: 'sp-18prizm-luka', condition: 'GRADED', gradingCompany: 'PSA', grade: 9, certNumber: '67001234', listingStatus: 'FOR_TRADE', purchasePriceCents: 30000 },
      { ref: 'sp-03chrome-lebron', condition: 'GRADED', gradingCompany: 'BGS', grade: 9.5, certNumber: '0011223344', listingStatus: 'PERSONAL' },
      { ref: 'sp-17prizm-mahomes', condition: 'RAW', listingStatus: 'FOR_SALE', askingPriceCents: 2500, purchasePriceCents: 15000 },
    ],
  },
  {
    email: 'alex@example.com',
    username: 'alex',
    displayName: 'Alex',
    bio: 'One Piece first, sports second. Looking for Luffy alt arts.',
    location: 'San Antonio, TX',
    socialLinks: { instagram: '@grandlinecards', x: '@grandlinecards' },
    vendor: {
      businessName: 'Grand Line Cards',
      description: 'One Piece TCG singles, graded slabs and sports rookies. Trades welcome at every show.',
      website: 'https://grandlinecards.example.com',
      socialLinks: { instagram: '@grandlinecards', tiktok: '@grandlinecards' },
    },
    items: [
      { ref: 'op-op05-luffy-manga', condition: 'NEAR_MINT', listingStatus: 'TRADE_AND_SALE', askingPriceCents: 145000, purchasePriceCents: 140000 },
      { ref: 'op-op01-zoro-alt', condition: 'GRADED', gradingCompany: 'PSA', grade: 10, certNumber: '90887766', listingStatus: 'FOR_TRADE' },
      { ref: 'op-op01-luffy-leader', condition: 'MINT', quantity: 4, listingStatus: 'FOR_SALE', askingPriceCents: 900 },
      { ref: 'op-op01-law', condition: 'NEAR_MINT', listingStatus: 'PERSONAL' },
      { ref: 'pkm-paf-charizard-ex', condition: 'GRADED', gradingCompany: 'CGC', grade: 9.5, certNumber: '4123009871', listingStatus: 'TRADE_AND_SALE' },
      { ref: 'pkm-151-mew-ex', condition: 'NEAR_MINT', listingStatus: 'FOR_TRADE' },
      { ref: 'sp-23prizm-wemby', condition: 'GRADED', gradingCompany: 'PSA', grade: 10, certNumber: '77665544', listingStatus: 'FOR_SALE', askingPriceCents: 52000 },
      { ref: 'sp-11update-trout', condition: 'RAW', listingStatus: 'PERSONAL' },
    ],
  },
  {
    email: 'sam@example.com',
    username: 'sam_shows',
    displayName: 'Sam',
    bio: 'I run Texas card shows. Vendors: apply in the app, tables are assigned first come, first served.',
    location: 'Austin, TX',
    socialLinks: { website: 'https://texascardshows.example.com' },
    items: [],
  },
];

export interface SeedEvent {
  title: string;
  organizerEmail: string;
  /** days from today (UTC) */
  startsInDays: number;
  startHourUtc: number;
  durationHours: number;
  venueName: string;
  address: string;
  city: string;
  region: string;
  admission: string;
  organizerName: string;
  website: string;
  description: string;
  /** approved vendors: email → table; they bring every listed card */
  vendors: Record<string, string>;
  /** attendees who marked the event "Interested" */
  savedBy: string[];
}

export const SEED_EVENTS: SeedEvent[] = [
  {
    title: 'Austin Card Show',
    organizerEmail: 'sam@example.com',
    startsInDays: 10,
    startHourUtc: 15,
    durationHours: 8,
    venueName: 'Palmer Events Center',
    address: '900 Barton Springs Rd',
    city: 'Austin',
    region: 'TX',
    admission: '$10 · Kids under 12 free',
    organizerName: 'Texas Card Shows',
    website: 'https://texascardshows.example.com/austin',
    description: '150+ tables of Pokémon, One Piece and sports cards. On-site grading drop-off and a trade night corner.',
    vendors: { 'alex@example.com': '14' },
    savedBy: ['tom@example.com'],
  },
  {
    title: 'Dallas Collectors Expo',
    organizerEmail: 'sam@example.com',
    startsInDays: 38,
    startHourUtc: 16,
    durationHours: 30,
    venueName: 'Market Hall',
    address: '2200 N Stemmons Fwy',
    city: 'Dallas',
    region: 'TX',
    admission: '$15 weekend pass',
    organizerName: 'Texas Card Shows',
    website: 'https://texascardshows.example.com/dallas',
    description: 'Two-day expo with vendors from across the state. Vendor applications are open.',
    vendors: {},
    savedBy: [],
  },
];
