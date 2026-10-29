/**
 * Option sets for the editable profile. Values match the backend's Pydantic
 * Literals (src/models/__init__.py); labels are what the UI shows.
 */
export interface Option {
  value: string;
  label: string;
}

export const RELATIONSHIP_OPTIONS: Option[] = [
  { value: 'single', label: 'Single' },
  { value: 'partner', label: 'Partner' },
  { value: 'family', label: 'Family' },
];

export const HOUSEHOLD_OPTIONS: Option[] = [
  { value: 'owning', label: 'Owning' },
  { value: 'renting', label: 'Renting' },
  { value: 'mortgaging', label: 'Mortgaging' },
];

export const CAR_OPTIONS: Option[] = [
  { value: 'financed', label: 'Financed' },
  { value: 'owned', label: 'Owned' },
  { value: 'rental', label: 'Rental' },
];

export const TRAVEL_OPTIONS: Option[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'leisure', label: 'Leisure' },
  { value: 'savings', label: 'Savings' },
];

export const US_STATUS_OPTIONS: Option[] = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'visa', label: 'Visa' },
  { value: 'green_card', label: 'Green Card' },
  { value: 'visitor', label: 'Visitor' },
];

/**
 * Sub-types shown when the parent US status is "visa" or "green_card".
 * Keyed by the parent value; empty for statuses with no sub-type.
 */
export const US_STATUS_DETAILS: Record<string, Option[]> = {
  visa: [
    { value: 'H-1B', label: 'H-1B — Specialty occupation' },
    { value: 'H-4', label: 'H-4 — Dependent of H visa holder' },
    { value: 'L-1', label: 'L-1 — Intracompany transferee' },
    { value: 'L-2', label: 'L-2 — Dependent of L-1' },
    { value: 'F-1', label: 'F-1 — Student' },
    { value: 'J-1', label: 'J-1 — Exchange visitor' },
    { value: 'O-1', label: 'O-1 — Extraordinary ability' },
    { value: 'TN', label: 'TN — USMCA professional' },
    { value: 'E-2', label: 'E-2 — Treaty investor' },
    { value: 'B-1/B-2', label: 'B-1/B-2 — Business / tourism' },
    { value: 'other', label: 'Other visa' },
  ],
  green_card: [
    { value: 'EB-1', label: 'EB-1 — Priority workers' },
    { value: 'EB-2', label: 'EB-2 — Advanced degree / exceptional ability' },
    { value: 'EB-3', label: 'EB-3 — Skilled / professional workers' },
    { value: 'EB-5', label: 'EB-5 — Investor' },
    { value: 'family', label: 'Family-sponsored' },
    { value: 'spouse', label: 'Spouse of US citizen / resident' },
    { value: 'diversity', label: 'Diversity (DV) lottery' },
    { value: 'asylee', label: 'Asylee / refugee based' },
    { value: 'other', label: 'Other category' },
  ],
};

/** Airlines offered for ranking (ordered preference). */
export const AIRLINES: string[] = [
  'Delta',
  'American Airlines',
  'United',
  'Southwest',
  'JetBlue',
  'Alaska Airlines',
  'Frontier',
  'Spirit',
  'Hawaiian Airlines',
];

/**
 * Online retailers offered for ranking (searchable dropdown, ordered
 * preference). Alphabetical so the searchable list is easy to scan.
 */
export const ONLINE_SHOPPING: string[] = [
  'Amazon',
  'Apple',
  'Best Buy',
  'Chewy',
  'Costco',
  'eBay',
  'Etsy',
  'Home Depot',
  'Instacart',
  "Kohl's",
  "Lowe's",
  'Nike',
  'Nordstrom',
  'Samsung',
  'Sephora',
  'Shein',
  'Target',
  'Temu',
  'Walmart',
  'Wayfair',
];

/**
 * Brick-and-mortar stores offered for ranking (searchable dropdown, ordered
 * preference).
 */
export const OFFLINE_SHOPPING: string[] = [
  'Aldi',
  'Best Buy',
  'BJ\'s Wholesale',
  'Costco',
  'CVS',
  'Dollar General',
  'Home Depot',
  'IKEA',
  'Kroger',
  "Lowe's",
  "Macy's",
  'Publix',
  'Safeway',
  "Sam's Club",
  'Target',
  'Trader Joe\'s',
  'Walgreens',
  'Walmart',
  'Whole Foods',
];

/** Known banks offered as a dropdown (no free text). */
export const KNOWN_BANKS: string[] = [
  'Bank of America',
  'Chase',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'U.S. Bank',
  'American Express',
  'Discover',
  'PNC Bank',
  'TD Bank',
  'Truist',
  'HSBC',
  'Goldman Sachs (Marcus)',
  'Barclays',
  'Synchrony',
];

/** US states + DC. Country defaults to United States. */
export const US_STATES: string[] = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

export const DEFAULT_COUNTRY = 'United States';

/** Categories a held card can be tagged with. Extend freely. */
export const CARD_CATEGORIES: string[] = [
  'all',
  'shopping',
  'fuel',
  'travel',
  'groceries',
  'rent',
  'premium',
  'flight',
  'cashback',
  'dining',
  'everyday',
];
