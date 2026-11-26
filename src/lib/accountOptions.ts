import type { AccountWithBalance, CreditCardProfile } from './db/queries';
import type { PickerOption } from '@/components/Picker';
import { moneyWithSymbol } from './money';

// Credit and prepaid cards are what most day-to-day spending goes on, so
// they lead every account list; bank and mobile banking follow, then cash.
// A "prepaid" card is stored as a bank account and recognised by its name.
function rank(a: AccountWithBalance, isCard: boolean): number {
  if (isCard || /prepaid/i.test(a.name)) return 0;
  return a.type === 'cash' ? 2 : 1;
}

const GROUP = ['Cards', 'Bank and mobile banking', 'Cash'];

export function accountOptions(
  accs: AccountWithBalance[],
  cards: CreditCardProfile[],
  { showBalance = true, cardsFirst = true }: { showBalance?: boolean; cardsFirst?: boolean } = {},
): PickerOption[] {
  const cardById = new Map(cards.map((c) => [c.accountId, c]));
  // Money coming in rarely lands on a card, so income lists put banks first.
  const order = cardsFirst ? [0, 1, 2] : [1, 2, 0];
  return accs
    .map((a) => ({ a, r: rank(a, cardById.has(a.id)) }))
    .sort((x, y) => order.indexOf(x.r) - order.indexOf(y.r) || x.a.name.localeCompare(y.a.name))
    .map(({ a, r }) => {
      const card = cardById.get(a.id);
      const detail = !showBalance
        ? undefined
        : card
          ? `${moneyWithSymbol(card.availableLimit)} free`
          : moneyWithSymbol(a.currentBalance);
      return {
        value: String(a.id),
        label: a.closedAt ? `${a.name} (closed)` : a.name,
        detail,
        group: GROUP[r],
      };
    });
}
