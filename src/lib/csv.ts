// Any unescaped quote, comma or newline in a note or account name splits the
// row and shifts every column after it, so every text cell goes through here.
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  // A cell starting with = + - @ (or a tab/CR) runs as a formula when the file
  // is opened in Excel or Sheets. A leading apostrophe keeps it plain text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

// Excel opens CSV as the system codepage unless a BOM says otherwise, which
// mangles Bengali text and currency signs.
export function csvResponseBody(lines: string[]): string {
  return '﻿' + lines.join('\r\n');
}
