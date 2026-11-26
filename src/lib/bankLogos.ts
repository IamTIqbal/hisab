// Banks and mobile wallets (MFS) Hisab knows by sight: the mobile wallets and
// the scheduled banks of Bangladesh.
//
// Each provider appears as a one-tap tile on the "New account" form, and any
// account whose name contains one of its keywords shows its logo. Every other
// account shows a neutral badge with its first letter.
//
// Logo files come from each provider's official website (the site's own
// icon, or the emblem cropped from the logo in its header). Where the
// official site blocked downloads, the logo comes from the provider's
// Wikipedia / Wikimedia Commons page, or was supplied by the maintainer.
// Each is fitted to a 128×128
// transparent PNG. A provider with `src: null` shows its initial
// until a logo is added.
//
// To add one:
//   1. Put a square logo in public/logo/ — PNG (at least 96×96) or SVG.
//   2. Add an entry below. `keywords` are lower case and matched as whole
//      words in the account name; list longer, more specific providers first,
//      because the first match wins.
//
// Logos are trademarks of their owners and are shown only to label the
// owner's own accounts.
//
// This file is plain data with no server imports, so client components can
// use it too.

export type ProviderKind = 'mfs' | 'bank';

export interface Provider {
  /** What the tile shows and what the account name is set to. */
  name: string;
  /** Full legal name, filled into "Bank name" for bank details. */
  legalName: string;
  kind: ProviderKind;
  keywords: string[];
  src: string | null;
}

export const PROVIDERS: Provider[] = [
  // ── Mobile financial services ──
  { name: 'bKash', legalName: 'bKash Limited', kind: 'mfs', keywords: ['bkash'], src: '/logo/bkash.png' },
  { name: 'Nagad', legalName: 'Nagad', kind: 'mfs', keywords: ['nagad'], src: '/logo/nagad.png' },
  { name: 'Rocket', legalName: 'Dutch-Bangla Bank Rocket', kind: 'mfs', keywords: ['rocket'], src: '/logo/rocket.png' },
  { name: 'Upay', legalName: 'UCB Fintech (Upay)', kind: 'mfs', keywords: ['upay'], src: '/logo/upay.png' },
  { name: 'tap', legalName: 'Trust Axiata Pay (tap)', kind: 'mfs', keywords: ['tap', 'trust axiata'], src: '/logo/tap.png' },
  { name: 'mCash', legalName: 'Islami Bank mCash', kind: 'mfs', keywords: ['mcash'], src: '/logo/mcash.png' },
  { name: 'SureCash', legalName: 'SureCash', kind: 'mfs', keywords: ['surecash', 'sure cash'], src: '/logo/surecash.png' },
  { name: 'OK Wallet', legalName: 'ONE Bank OK Wallet', kind: 'mfs', keywords: ['ok wallet', 'okwallet'], src: '/logo/okwallet.png' },
  { name: 'Meghna Pay', legalName: 'Meghna Bank (Meghna Pay)', kind: 'mfs', keywords: ['meghna pay', 'meghnapay'], src: '/logo/meghnapay.png' },

  // ── Banks ──
  // State-owned commercial
  { name: 'Sonali Bank', legalName: 'Sonali Bank PLC', kind: 'bank', keywords: ['sonali'], src: '/logo/sonali.png' },
  { name: 'Janata Bank', legalName: 'Janata Bank PLC', kind: 'bank', keywords: ['janata'], src: '/logo/janata.png' },
  { name: 'Agrani Bank', legalName: 'Agrani Bank PLC', kind: 'bank', keywords: ['agrani'], src: '/logo/agrani.png' },
  { name: 'Rupali Bank', legalName: 'Rupali Bank PLC', kind: 'bank', keywords: ['rupali'], src: '/logo/rupali.png' },
  { name: 'BASIC Bank', legalName: 'BASIC Bank Limited', kind: 'bank', keywords: ['basic bank'], src: '/logo/basic.png' },
  { name: 'BDBL', legalName: 'Bangladesh Development Bank PLC', kind: 'bank', keywords: ['bdbl', 'bangladesh development bank'], src: '/logo/bdbl.png' },

  // Specialised
  { name: 'RAKUB', legalName: 'Rajshahi Krishi Unnayan Bank', kind: 'bank', keywords: ['rakub', 'rajshahi krishi'], src: '/logo/rakub.png' },
  { name: 'Krishi Bank', legalName: 'Bangladesh Krishi Bank', kind: 'bank', keywords: ['krishi bank', 'bkb'], src: '/logo/bkb.png' },
  { name: 'Probashi Kallyan Bank', legalName: 'Probashi Kallyan Bank', kind: 'bank', keywords: ['probashi', 'pkb'], src: '/logo/pkb.png' },
  { name: 'Palli Sanchay Bank', legalName: 'Palli Sanchay Bank', kind: 'bank', keywords: ['palli sanchay'], src: '/logo/psb.png' },

  // Private commercial (more specific names first: the first match wins)
  { name: 'Dutch-Bangla Bank', legalName: 'Dutch-Bangla Bank PLC', kind: 'bank', keywords: ['dutch-bangla', 'dutch bangla', 'dbbl'], src: '/logo/dbbl.png' },
  { name: 'BRAC Bank', legalName: 'BRAC Bank PLC', kind: 'bank', keywords: ['brac'], src: '/logo/brac.png' },
  { name: 'City Bank', legalName: 'The City Bank PLC', kind: 'bank', keywords: ['city bank'], src: '/logo/city.png' },
  { name: 'Bank Asia', legalName: 'Bank Asia PLC', kind: 'bank', keywords: ['bank asia'], src: '/logo/asia.png' },
  { name: 'UCB', legalName: 'United Commercial Bank PLC', kind: 'bank', keywords: ['ucb', 'united commercial'], src: '/logo/ucb.png' },
  { name: 'NRBC Bank', legalName: 'NRB Commercial Bank PLC', kind: 'bank', keywords: ['nrbc', 'nrb commercial'], src: '/logo/nrbc.png' },
  { name: 'NRB Bank', legalName: 'NRB Bank PLC', kind: 'bank', keywords: ['nrb'], src: '/logo/nrb.png' },
  { name: 'National Bank of Pakistan', legalName: 'National Bank of Pakistan', kind: 'bank', keywords: ['national bank of pakistan', 'nbp'], src: '/logo/nbp.png' },
  { name: 'National Bank', legalName: 'National Bank PLC', kind: 'bank', keywords: ['national bank', 'nbl'], src: '/logo/nbl.png' },
  { name: 'Mutual Trust Bank', legalName: 'Mutual Trust Bank PLC', kind: 'bank', keywords: ['mutual trust', 'mtb'], src: '/logo/mtb.png' },
  { name: 'Trust Bank', legalName: 'Trust Bank PLC', kind: 'bank', keywords: ['trust bank'], src: '/logo/trust.png' },
  { name: 'AB Bank', legalName: 'AB Bank PLC', kind: 'bank', keywords: ['ab bank', 'abbl'], src: '/logo/ab.png' },
  { name: 'Bangladesh Commerce Bank', legalName: 'Bangladesh Commerce Bank Limited', kind: 'bank', keywords: ['bangladesh commerce', 'bcbl'], src: '/logo/bcb.png' },
  { name: 'Bengal Commercial Bank', legalName: 'Bengal Commercial Bank PLC', kind: 'bank', keywords: ['bengal commercial'], src: '/logo/bengal.png' },
  { name: 'Citizens Bank', legalName: 'Citizens Bank PLC', kind: 'bank', keywords: ['citizens bank'], src: '/logo/citizens.png' },
  { name: 'Community Bank', legalName: 'Community Bank Bangladesh PLC', kind: 'bank', keywords: ['community bank'], src: '/logo/community.png' },
  { name: 'Dhaka Bank', legalName: 'Dhaka Bank PLC', kind: 'bank', keywords: ['dhaka bank'], src: '/logo/dhaka.png' },
  { name: 'Eastern Bank', legalName: 'Eastern Bank PLC', kind: 'bank', keywords: ['eastern bank', 'ebl'], src: '/logo/ebl.png' },
  { name: 'IFIC Bank', legalName: 'IFIC Bank PLC', kind: 'bank', keywords: ['ific'], src: '/logo/ific.png' },
  { name: 'Jamuna Bank', legalName: 'Jamuna Bank PLC', kind: 'bank', keywords: ['jamuna'], src: '/logo/jamuna.png' },
  { name: 'Meghna Bank', legalName: 'Meghna Bank PLC', kind: 'bank', keywords: ['meghna bank'], src: '/logo/meghnapay.png' },
  { name: 'Mercantile Bank', legalName: 'Mercantile Bank PLC', kind: 'bank', keywords: ['mercantile'], src: '/logo/mercantile.png' },
  { name: 'Midland Bank', legalName: 'Midland Bank PLC', kind: 'bank', keywords: ['midland'], src: '/logo/midland.png' },
  { name: 'Modhumoti Bank', legalName: 'Modhumoti Bank PLC', kind: 'bank', keywords: ['modhumoti'], src: '/logo/modhumoti.png' },
  { name: 'NCC Bank', legalName: 'NCC Bank PLC', kind: 'bank', keywords: ['ncc'], src: '/logo/ncc.png' },
  { name: 'ONE Bank', legalName: 'ONE Bank PLC', kind: 'bank', keywords: ['one bank'], src: '/logo/one.png' },
  { name: 'Padma Bank', legalName: 'Padma Bank PLC', kind: 'bank', keywords: ['padma'], src: '/logo/padma.png' },
  { name: 'Premier Bank', legalName: 'The Premier Bank PLC', kind: 'bank', keywords: ['premier bank'], src: '/logo/premier.png' },
  { name: 'Prime Bank', legalName: 'Prime Bank PLC', kind: 'bank', keywords: ['prime bank'], src: '/logo/prime.png' },
  { name: 'Pubali Bank', legalName: 'Pubali Bank PLC', kind: 'bank', keywords: ['pubali'], src: '/logo/pubali.png' },
  { name: 'Shimanto Bank', legalName: 'Shimanto Bank PLC', kind: 'bank', keywords: ['shimanto'], src: '/logo/shimanto.png' },
  { name: 'SBAC Bank', legalName: 'South Bangla Agriculture and Commerce Bank PLC', kind: 'bank', keywords: ['sbac', 'south bangla'], src: '/logo/sbac.png' },
  { name: 'Southeast Bank', legalName: 'Southeast Bank PLC', kind: 'bank', keywords: ['southeast'], src: '/logo/southeast.png' },
  { name: 'Uttara Bank', legalName: 'Uttara Bank PLC', kind: 'bank', keywords: ['uttara'], src: '/logo/uttara.png' },

  // Islamic ("Islami Bank" last: the other names contain it too)
  { name: 'Al-Arafah Islami Bank', legalName: 'Al-Arafah Islami Bank PLC', kind: 'bank', keywords: ['al-arafah', 'al arafah', 'aibl'], src: '/logo/alarafah.png' },
  { name: 'EXIM Bank', legalName: 'Export Import Bank of Bangladesh PLC', kind: 'bank', keywords: ['exim'], src: '/logo/exim.png' },
  { name: 'First Security Islami Bank', legalName: 'First Security Islami Bank PLC', kind: 'bank', keywords: ['first security', 'fsibl'], src: '/logo/fsib.png' },
  { name: 'Global Islami Bank', legalName: 'Global Islami Bank PLC', kind: 'bank', keywords: ['global islami'], src: '/logo/gib.png' },
  { name: 'ICB Islamic Bank', legalName: 'ICB Islamic Bank Limited', kind: 'bank', keywords: ['icb islamic'], src: '/logo/icbislamic.png' },
  { name: 'Shahjalal Islami Bank', legalName: 'Shahjalal Islami Bank PLC', kind: 'bank', keywords: ['shahjalal', 'sjibl'], src: '/logo/sjibl.png' },
  { name: 'Social Islami Bank', legalName: 'Social Islami Bank PLC', kind: 'bank', keywords: ['social islami', 'sibl'], src: '/logo/sibl.png' },
  { name: 'Standard Islami Bank', legalName: 'Standard Islami Bank PLC', kind: 'bank', keywords: ['standard islami', 'standard bank'], src: '/logo/standard.png' },
  { name: 'Union Bank', legalName: 'Union Bank PLC', kind: 'bank', keywords: ['union bank'], src: '/logo/union.png' },
  { name: 'Islami Bank', legalName: 'Islami Bank Bangladesh PLC', kind: 'bank', keywords: ['islami bank', 'ibbl'], src: '/logo/islami.png' },

  // Foreign
  { name: 'Standard Chartered', legalName: 'Standard Chartered Bank', kind: 'bank', keywords: ['standard chartered', 'scb'], src: '/logo/scb.png' },
  { name: 'HSBC', legalName: 'The Hongkong and Shanghai Banking Corporation', kind: 'bank', keywords: ['hsbc'], src: '/logo/hsbc.png' },
  { name: 'Citibank', legalName: 'Citibank N.A.', kind: 'bank', keywords: ['citibank', 'citi bank'], src: '/logo/citi.png' },
  { name: 'Commercial Bank of Ceylon', legalName: 'Commercial Bank of Ceylon PLC', kind: 'bank', keywords: ['commercial bank of ceylon', 'combank'], src: '/logo/cbc.png' },
  { name: 'Habib Bank', legalName: 'Habib Bank Limited', kind: 'bank', keywords: ['habib bank', 'hbl'], src: '/logo/hbl.png' },
  { name: 'State Bank of India', legalName: 'State Bank of India', kind: 'bank', keywords: ['state bank of india', 'sbi'], src: '/logo/sbi.png' },
  { name: 'Woori Bank', legalName: 'Woori Bank', kind: 'bank', keywords: ['woori'], src: '/logo/woori.png' },
  { name: 'Bank Alfalah', legalName: 'Bank Alfalah Limited', kind: 'bank', keywords: ['alfalah'], src: '/logo/alfalah.png' },
  { name: 'ICICI Bank', legalName: 'ICICI Bank Limited', kind: 'bank', keywords: ['icici'], src: '/logo/icici.png' },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match, so "tap" finds "tap wallet" but not "Startup Fund".
const MATCHERS = PROVIDERS.map((p) => ({
  p,
  re: new RegExp(`(^|[^a-z0-9])(${p.keywords.map(escapeRe).join('|')})(?=$|[^a-z0-9])`, 'i'),
}));

export function providerFor(accountName: string): Provider | null {
  return MATCHERS.find(({ re }) => re.test(accountName))?.p ?? null;
}

export function bankLogoFor(accountName: string): { src: string; alt: string } | null {
  const p = providerFor(accountName);
  return p?.src ? { src: p.src, alt: p.name } : null;
}
