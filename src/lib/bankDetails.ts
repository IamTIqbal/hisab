import type { AccountWithBalance } from './db/queries';

// The lines a payer needs, in the order Bangladeshi banks print them on a
// cheque leaf or deposit slip. Blank fields are left out.
export function bankDetailLines(acc: AccountWithBalance): [string, string][] {
  const lines: [string, string][] = [
    ['Account Name', acc.holderName ?? ''],
    ['Account Number', acc.accountNumber ?? ''],
    ['Bank Name', acc.bankName ?? ''],
    ['Branch Name', acc.branchName ?? ''],
    ['Routing Number', acc.routingNumber ?? ''],
  ];
  return lines.filter(([, v]) => v.trim() !== '');
}

export function bankDetailsText(acc: AccountWithBalance): string {
  return bankDetailLines(acc).map(([k, v]) => `${k} : ${v}`).join('\n');
}
