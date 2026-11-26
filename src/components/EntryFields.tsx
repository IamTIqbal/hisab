'use client';

import { useState } from 'react';

// Shared fields for the entry forms (expense, income, loan, transfer).
// Each posts under the same field name as the plain input it replaces, so
// the server actions are unchanged.

export function AmountField({
  name = 'amount',
  label = 'Amount',
  defaultValue,
  autoFocus,
  max,
}: {
  name?: string;
  label?: string;
  defaultValue?: number | string;
  autoFocus?: boolean;
  max?: number;
}) {
  return (
    <label className="field field-amount">
      <span>{label}</span>
      <span className="money-field">
        <input
          name={name}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={max}
          className="input input-amount"
          defaultValue={defaultValue ?? ''}
          placeholder="0"
          required
          autoFocus={autoFocus}
          enterKeyHint="next"
        />
      </span>
    </label>
  );
}

// A row of one-tap choices, posted as a radio group. Faster than a dropdown
// when every option fits on screen.
export function ChoiceChips({
  name,
  label,
  options,
  defaultValue,
  columns,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  columns?: number;
}) {
  return (
    <fieldset className="field choice">
      <legend>{label}</legend>
      <div className="choice-grid" style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {options.map((o) => (
          <label key={o.value} className="choice-chip">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} required />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Most entries are for today or yesterday; one tap covers both, and the
// calendar is there for anything older.
export function DateField({ name = 'txn_date', label = 'Date', defaultValue, today }: { name?: string; label?: string; defaultValue: string; today: string }) {
  const [value, setValue] = useState(defaultValue);
  const yesterday = shiftIso(today, -1);
  return (
    <div className="field">
      <span id={`${name}-l`}>{label}</span>
      <div className="date-row">
        <div className="seg" role="group" aria-labelledby={`${name}-l`}>
          <button type="button" aria-pressed={value === today} onClick={() => setValue(today)}>Today</button>
          <button type="button" aria-pressed={value === yesterday} onClick={() => setValue(yesterday)}>Yesterday</button>
        </div>
        <input
          name={name}
          type="date"
          className="input"
          value={value}
          max={today}
          onChange={(e) => setValue(e.target.value)}
          aria-labelledby={`${name}-l`}
          required
        />
      </div>
    </div>
  );
}
