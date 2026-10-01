import type { Ionicons } from '@expo/vector-icons';

/** Help Center content. Plain data so search and tests don't need React. */

export type HelpSectionId =
  | 'getting-started'
  | 'adding-cards'
  | 'scanning'
  | 'trading'
  | 'values'
  | 'collection'
  | 'account'
  | 'two-factor'
  | 'notifications'
  | 'privacy'
  | 'contact';

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export type HelpBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'tip'; text: string };

export interface HelpArticle {
  id: string;
  section: HelpSectionId;
  title: string;
  /** one line under the title in lists */
  summary: string;
  blocks: HelpBlock[];
}

export const HELP_SECTIONS: HelpSection[] = [
  { id: 'getting-started', title: 'Getting Started', icon: 'rocket-outline' },
  { id: 'adding-cards', title: 'Adding Cards', icon: 'add-circle-outline' },
  { id: 'scanning', title: 'Scanning QR Codes', icon: 'scan-outline' },
  { id: 'trading', title: 'Trading Cards', icon: 'swap-horizontal-outline' },
  { id: 'values', title: 'Understanding Card Values', icon: 'trending-up-outline' },
  { id: 'collection', title: 'Managing Your Collection', icon: 'albums-outline' },
  { id: 'account', title: 'Account & Login', icon: 'person-circle-outline' },
  { id: 'two-factor', title: 'Two-Factor Authentication', icon: 'shield-checkmark-outline' },
  { id: 'notifications', title: 'Notifications', icon: 'notifications-outline' },
  { id: 'privacy', title: 'Privacy & Security', icon: 'lock-closed-outline' },
  { id: 'contact', title: 'Contact Support', icon: 'mail-outline' },
];

const p = (text: string): HelpBlock => ({ kind: 'paragraph', text });
const steps = (...items: string[]): HelpBlock => ({ kind: 'steps', items });
const tip = (text: string): HelpBlock => ({ kind: 'tip', text });

export const HELP_ARTICLES: HelpArticle[] = [
  // ───────────── Getting Started ─────────────
  {
    id: 'what-is-card-trader',
    section: 'getting-started',
    title: 'What you can do with Card Trader',
    summary: 'Track your cards, see what they’re worth and trade in person.',
    blocks: [
      p('Card Trader keeps your Pokémon, One Piece and sports cards in one inventory, estimates what they’re worth from recent sales, and makes trading face to face at card shows quick and fair.'),
      p('The five tabs at the bottom are: Discover (your collection value, upcoming shows and open trades), Inventory (your cards), Trade (active trades), Events (card shows) and Profile (your public profile, QR code and settings).'),
      tip('At a show, the fastest way to start a trade is to scan the other collector’s QR code — no typing needed.'),
    ],
  },
  {
    id: 'first-steps',
    section: 'getting-started',
    title: 'Your first five minutes',
    summary: 'Set up your profile, add a card and find a show.',
    blocks: [
      steps(
        'Open Profile → Edit profile and add a display name, photo and location so other collectors recognise you.',
        'Go to Inventory and tap + to add your first card.',
        'Set the cards you’re willing to part with to For trade, For sale or Trade + sale.',
        'Open Events to find upcoming card shows near you and mark the ones you’re interested in.',
        'At the show, open My QR (on Discover or Profile) so others can scan you.',
      ),
    ],
  },

  // ───────────── Adding Cards ─────────────
  {
    id: 'add-card',
    section: 'adding-cards',
    title: 'Add a card to your inventory',
    summary: 'Search the catalog, then choose raw or graded.',
    blocks: [
      steps(
        'Tap Add card on Discover, or + in Inventory.',
        'Search by card name or number and pick the right card and set.',
        'Choose the condition: a raw condition (Mint, Near Mint, Excellent…) or Graded.',
        'For graded cards pick the company (PSA, BGS, CGC or other), enter the grade and, if you like, the cert number.',
        'Enter the quantity and, optionally, what you paid and when — that’s only visible to you and powers your gain/loss.',
        'Choose a listing status and save.',
      ),
      tip('Raw and graded copies of the same card are valued separately. A PSA 10 is never priced like a raw Near Mint copy.'),
    ],
  },
  {
    id: 'missing-card',
    section: 'adding-cards',
    title: 'My card isn’t in the catalog',
    summary: 'Submit a missing card yourself.',
    blocks: [
      p('If searching by name and number finds nothing, tap “Add a missing card” on the search screen and fill in the details.'),
      p('Submitted cards are visible to you right away and reviewed before they appear for other collectors. Until comparable sales exist, the card shows without a market value.'),
    ],
  },
  {
    id: 'listing-status',
    section: 'adding-cards',
    title: 'Listing statuses explained',
    summary: 'Personal, For trade, For sale, Trade + sale.',
    blocks: [
      p('Personal collection: only you can see the card. It never shows on your public profile or in show searches.'),
      p('For trade: other collectors can see it and add it to a trade with you.'),
      p('For sale: visible with your asking price (if you set one). Without an asking price, others see the estimated value.'),
      p('Trade + sale: open to both.'),
      tip('You can change the status any time from the card’s Edit screen — for example, switch cards to Personal after a show.'),
    ],
  },

  // ───────────── Scanning QR Codes ─────────────
  {
    id: 'scan-qr',
    section: 'scanning',
    title: 'Scan another collector’s QR code',
    summary: 'Open their profile and the cards they’ll trade.',
    blocks: [
      steps(
        'Tap the scan icon on Discover, or Scan QR in the quick actions.',
        'Allow camera access the first time.',
        'Point the camera at their Card Trader QR code. Their profile opens straight away.',
        'Tap “Start a trade”, or browse the cards they have for trade or sale.',
      ),
      p('Only Card Trader profile codes are accepted; other QR codes (Wi-Fi, websites) are ignored for your safety.'),
      tip('Camera not working? Ask for their public code (shown under their QR) and type it into “Or enter their code”.'),
    ],
  },
  {
    id: 'my-qr',
    section: 'scanning',
    title: 'Show your own QR code',
    summary: 'Let others open your profile in one scan.',
    blocks: [
      p('Open My QR from Discover or Profile. Others scan it with Card Trader — or with their phone camera, which opens the app on your profile.'),
      p('Your QR code works offline, so it still shows when the signal at a busy show is poor. You can also share your profile link from the same screen.'),
    ],
  },

  // ───────────── Trading Cards ─────────────
  {
    id: 'start-trade',
    section: 'trading',
    title: 'Start and send a trade',
    summary: 'Build both sides, balance with cash, send the offer.',
    blocks: [
      steps(
        'Open the other collector’s profile (scan their QR or search a show) and tap Start a trade.',
        'Add the cards you’ll give under My offer, and the cards you want under Their offer.',
        'Check the totals. The app suggests a cash amount that balances the values; you can change it or set no cash.',
        'Tap Send offer. They get a notification and can accept, decline or counter.',
      ),
      tip('Tap Refresh values before sending if the trade has been open for a while — prices update in the background.'),
    ],
  },
  {
    id: 'counteroffers',
    section: 'trading',
    title: 'Counteroffers and changing terms',
    summary: 'How offers go back and forth.',
    blocks: [
      p('When you receive an offer you can Accept it, Decline it, or tap Counter to change the cards or cash and send it back. The trade shows “Counteroffer” so both of you know the terms changed.'),
      p('If anyone changes the terms after the trade was accepted, both acceptances reset and the new terms must be sent and accepted again.'),
    ],
  },
  {
    id: 'complete-trade',
    section: 'trading',
    title: 'Complete a trade and leave a review',
    summary: 'Swap the cards, then both confirm received.',
    blocks: [
      steps(
        'After both of you accept, meet and swap the cards (and any cash).',
        'Only once you have everything, tap Confirm received.',
        'When both of you have confirmed, the trade completes and both inventories update automatically.',
        'Leave a review — it appears on the other collector’s public profile.',
      ),
      p('Completed trades keep the values, grades, cert numbers and comparable sales exactly as they were when the trade was accepted.'),
      tip('Cards in an accepted trade are locked: their condition and quantity can’t change until the trade completes or is cancelled.'),
    ],
  },
  {
    id: 'trade-safety',
    section: 'trading',
    title: 'Trading safely',
    summary: 'Tips for in-person trades.',
    blocks: [
      p('Card Trader doesn’t hold cards or money — trades happen in person. Check graded slabs and cert numbers before confirming, count cash, and never confirm received for something you haven’t got.'),
      p('Ratings and completed-trade counts on profiles show how others’ trades went. If something goes wrong, contact support with the trade details.'),
    ],
  },

  // ───────────── Understanding Card Values ─────────────
  {
    id: 'how-values-work',
    section: 'values',
    title: 'How market values are estimated',
    summary: 'Recent comparable sales of the same card and grade.',
    blocks: [
      p('Market values are estimates based on recent comparable sales. For each card, the estimate uses the median of the three most recent sales of the same card in the same condition or grade.'),
      p('Raw cards are never compared with graded cards, and grades from different companies are kept apart. You can see the comparable sales on the card’s details screen under “Last sold”.'),
      tip('Values are a guide, not an offer. The final price in a trade is whatever both of you agree.'),
    ],
  },
  {
    id: 'no-value',
    section: 'values',
    title: 'Why a card has no value yet',
    summary: 'No comparable sales found.',
    blocks: [
      p('If there are no recent sales of that exact card and grade, the card shows “awaiting a price” and isn’t counted in your collection value. Prices refresh in the background, so a value can appear later.'),
      p('If you list it for sale, set an asking price so others see a number.'),
    ],
  },
  {
    id: 'charts',
    section: 'values',
    title: 'Price charts and collection analytics',
    summary: 'See how values moved over time.',
    blocks: [
      p('Discover shows your collection value and its change today and over 30 days. Open Analytics for the full chart, top cards and biggest movers.'),
      p('Each card has its own price history. You can choose the default chart range in Settings.'),
    ],
  },

  // ───────────── Managing Your Collection ─────────────
  {
    id: 'edit-cards',
    section: 'collection',
    title: 'Edit or remove a card',
    summary: 'Change condition, quantity, status or notes.',
    blocks: [
      p('Open the card in Inventory and tap Edit to change its condition, grade, quantity, listing status, asking price or private notes. Tap Remove to delete it from your inventory.'),
      p('Use the filters and search in Inventory to find cards by category, status or name.'),
    ],
  },
  {
    id: 'shows-and-vendors',
    section: 'collection',
    title: 'Card shows and Vendor Mode',
    summary: 'Find shows, join as a vendor, bring inventory.',
    blocks: [
      p('Events lists upcoming card shows. Tap Interested to save a show; inside a show, “Search this event” finds cards that vendors and collectors there have for trade or sale.'),
      p('Selling at shows? Turn on Vendor Mode in your profile to add a business name and logo, then tap “Join as Vendor” on a show. Once the organizer approves you, choose which cards you’re bringing so attendees can find them.'),
      p('Organizers can create and publish their own shows and approve vendors and tables.'),
    ],
  },

  // ───────────── Account & Login ─────────────
  {
    id: 'sign-in-methods',
    section: 'account',
    title: 'Ways to sign in',
    summary: 'Email and password, Google or Apple.',
    blocks: [
      p('You can sign in with your email and password, and — where available on your phone — with Google or Apple. Manage them in Settings → Security → Sign-in methods.'),
      p('If you signed up with Google or Apple you can also set a password there. Keep at least one way to sign in linked.'),
      tip('If Google or Apple says an account with your email already exists, sign in with your password first, then link Google or Apple in Settings → Security.'),
    ],
  },
  {
    id: 'forgot-password',
    section: 'account',
    title: 'Change or reset your password',
    summary: 'Change it in Settings, or ask support.',
    blocks: [
      p('To change your password, go to Settings → Security → Password. Changing it signs you out on your other devices.'),
      p('Forgot it? Contact support from the email address on your account. An admin can set a temporary password; you’ll be asked to choose a new one the next time you sign in.'),
    ],
  },
  {
    id: 'locked-or-blocked',
    section: 'account',
    title: 'Locked out or account blocked',
    summary: 'Too many attempts, or blocked by an admin.',
    blocks: [
      p('After several wrong passwords in a row, sign-in is paused for a few minutes to protect your account. The message tells you how long to wait.'),
      p('If you see “Your account has been blocked”, an admin has restricted the account. Contact support from the email address on the account so we can review it.'),
    ],
  },

  // ───────────── Two-Factor Authentication ─────────────
  {
    id: '2fa-setup',
    section: 'two-factor',
    title: 'Turn on two-factor authentication',
    summary: 'Add an authenticator code to every sign-in.',
    blocks: [
      steps(
        'Install an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Authy.',
        'Go to Settings → Security and tap “Turn on two-factor authentication”.',
        'Scan the QR code with the authenticator, tap “Open authenticator app”, or type the key by hand.',
        'Enter the 6-digit code the app shows.',
        'Save your 10 recovery codes somewhere safe, then tap “I saved these codes”.',
      ),
      p('From then on, after your password (or Google/Apple) you’ll enter the current 6-digit code.'),
    ],
  },
  {
    id: '2fa-recovery',
    section: 'two-factor',
    title: 'Lost your phone? Use a recovery code',
    summary: 'Each recovery code works once.',
    blocks: [
      p('On the code screen, tap “Use a recovery code” and enter one of the codes you saved (like abcd-efgh-ijkl). Each code works only once.'),
      p('Once you’re in, go to Settings → Security to get new recovery codes or to set up 2FA on your new phone.'),
      p('No codes left and no authenticator? Contact support from the email address on your account.'),
    ],
  },
  {
    id: '2fa-trouble',
    section: 'two-factor',
    title: 'My code doesn’t work',
    summary: 'Clock settings and expired sign-ins.',
    blocks: [
      p('Codes change every 30 seconds. Make sure your phone’s date and time are set automatically — a clock that’s off is the most common cause.'),
      p('The code step expires 5 minutes after your password, or after 5 wrong codes. Then just sign in again.'),
    ],
  },

  // ───────────── Notifications ─────────────
  {
    id: 'notifications-overview',
    section: 'notifications',
    title: 'What you’re notified about',
    summary: 'Trades, reviews, shows and account notices.',
    blocks: [
      p('You get notifications for trade offers, counteroffers, acceptances, completions and cancellations; new reviews; vendor applications and decisions; show updates, cancellations and reminders; and announcements and security notices from Card Trader.'),
      p('The bell on Discover shows how many are unread. Tap it to see the latest; “Show all” opens the full history. Opening a notification marks it read and takes you to the trade, show or profile it’s about.'),
    ],
  },
  {
    id: 'notifications-phone',
    section: 'notifications',
    title: 'Banners and phone notifications',
    summary: 'In the app and in the background.',
    blocks: [
      p('While the app is open, new notifications slide in at the top of the screen. Tap View to open one, or swipe it up to dismiss.'),
      p('While the app is in the background, they arrive as phone notifications. Allow notifications when asked, or turn them on in your phone’s settings for Card Trader.'),
      tip('If Android closes the app completely, notifications wait until you open it again.'),
    ],
  },

  // ───────────── Privacy & Security ─────────────
  {
    id: 'what-others-see',
    section: 'privacy',
    title: 'What other collectors can see',
    summary: 'Your public profile and listed cards.',
    blocks: [
      p('Others see your display name, @username, photo, bio, location, social links, ratings and the cards you’ve listed for trade or sale. Your email, purchase prices, private notes and Personal cards are never shown.'),
    ],
  },
  {
    id: 'keep-account-safe',
    section: 'privacy',
    title: 'Keep your account safe',
    summary: 'Strong password and 2FA.',
    blocks: [
      p('Use a long password you don’t use anywhere else, and turn on two-factor authentication.'),
      p('Card Trader staff will never ask for your password or a 2FA code. If you notice something unusual, change your password — that signs out every other device — and contact support.'),
    ],
  },

  // ───────────── Contact Support ─────────────
  {
    id: 'contact-support',
    section: 'contact',
    title: 'Contact Card Trader support',
    summary: 'Email us — include what happened and when.',
    blocks: [
      p('Tap “Email support” below. Your app version, phone platform and public code are filled in to help us find your account faster — please don’t send your password or 2FA codes.'),
      p('Write from the email address on your account if you can’t sign in, so we can confirm it’s you.'),
    ],
  },
];

/** Words of an article that search looks at. */
function searchableText(article: HelpArticle): string {
  const body = article.blocks.map((b) => (b.kind === 'steps' ? b.items.join(' ') : b.text)).join(' ');
  return `${article.title} ${article.summary} ${body}`;
}

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '');

/**
 * Articles containing every word of the query (any order, case- and accent-
 * insensitive), title matches first.
 */
export function searchHelp(query: string, articles: HelpArticle[] = HELP_ARTICLES): HelpArticle[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = articles
    .map((article) => {
      const text = fold(searchableText(article));
      if (!terms.every((t) => text.includes(t))) return null;
      const title = fold(article.title);
      return { article, score: terms.filter((t) => title.includes(t)).length };
    })
    .filter((x): x is { article: HelpArticle; score: number } => x !== null);
  return scored.sort((a, b) => b.score - a.score).map((x) => x.article);
}

export const helpArticle = (id: string) => HELP_ARTICLES.find((a) => a.id === id);
export const articlesIn = (section: HelpSectionId) => HELP_ARTICLES.filter((a) => a.section === section);
