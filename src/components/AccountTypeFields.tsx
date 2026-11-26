'use client';

import { useState } from 'react';
import { PROVIDERS, type Provider } from '@/lib/bankLogos';

interface Props {
  currency: string;
  defaultName: string;
  /** New accounts get the one-tap bank and wallet tiles. */
  showProviders: boolean;
  defaultType: string;
  defaultAccountNumber: string;
  card?: { providerName: string; cardLast4: string; creditLimit: number } | null;
  bank?: { holderName: string | null; bankName: string | null; routingNumber: string | null } | null;
}

// The Type select plus the fields it governs. Rendering the card fields
// unconditionally made every plain bank account ask for a credit limit, so
// their visibility has to follow the select — which needs client state.
//
// A card has no free-text account number: the server derives the masked
// "**** **** **** 6500" from the last 4, so only the last 4 is asked for.
function ProviderTiles({ title, kind, onPick, selected }: { title: string; kind: Provider['kind']; onPick: (p: Provider) => void; selected: string }) {
  return (
    <div className="field span-all">
      <span>{title}</span>
      <div className="provider-grid" role="group" aria-label={title}>
        {PROVIDERS.filter((p) => p.kind === kind).map((p) => (
          <button
            key={p.name}
            type="button"
            className="provider-tile"
            aria-pressed={selected === p.name}
            onClick={() => onPick(p)}
          >
            {p.src ? (
              // eslint-disable-next-line @next/next/no-img-element -- tiny static logos
              <img src={p.src} alt="" width={36} height={36} />
            ) : (
              <span className="provider-initial" aria-hidden>{p.name.charAt(0).toUpperCase()}</span>
            )}
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AccountTypeFields({ currency, defaultName, showProviders, defaultType, defaultAccountNumber, card, bank }: Props) {
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState(defaultName);
  const [bankName, setBankName] = useState(bank?.bankName ?? '');
  const [picked, setPicked] = useState('');

  // A tap fills the name (and, for a bank, the bank name) and switches the
  // type to bank / mobile banking. Everything stays editable afterwards.
  function pick(p: Provider) {
    setPicked(p.name);
    setType('bank');
    setName(p.name);
    setBankName(p.legalName);
  }
  const [last4, setLast4] = useState(card?.cardLast4 ?? '');
  const isCredit = type === 'credit';
  const digits = last4.replace(/\D/g, '').slice(-4);

  return (
    <>
      {showProviders && (
        <>
          <ProviderTiles title="Mobile wallet" kind="mfs" onPick={pick} selected={picked} />
          <ProviderTiles title="Bank" kind="bank" onPick={pick} selected={picked} />
        </>
      )}
      <label className="field">
        <span>Name in Hisab</span>
        <input
          name="name"
          className="input"
          value={name}
          onChange={(e) => { setName(e.target.value); setPicked(''); }}
          placeholder="e.g. BRAC Bank, bKash, Wallet"
          required
          maxLength={80}
        />
        <span className="hint">{showProviders ? 'Tap one above, or type any name.' : 'Include the bank’s name and its logo shows up.'}</span>
      </label>
      <label className="field">
        <span>Type</span>
        <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="bank">Bank / Mobile Banking</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit Card</option>
        </select>
      </label>

      {isCredit ? (
        <>
          <label className="field">
            <span>Card number, last 4 digits</span>
            <input
              name="card_last4"
              className="input"
              inputMode="numeric"
              maxLength={19}
              autoComplete="off"
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              placeholder="e.g. 6500"
              required
            />
            <span className="hint">
              Stored as {digits.length === 4 ? `**** **** **** ${digits}` : '**** **** **** ____'}
            </span>
          </label>
          <label className="field">
            <span>Credit limit ({currency})</span>
            <input
              name="credit_limit"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className="input"
              defaultValue={card?.creditLimit ?? ''}
              placeholder="0.00"
              required
            />
          </label>
          <label className="field">
            <span>Card issuer</span>
            <input
              name="provider_name"
              className="input"
              defaultValue={card?.providerName ?? ''}
              placeholder="Same as account name if left blank"
            />
          </label>
        </>
      ) : (
        <label className="field">
          <span>Account number</span>
          <input name="account_number" className="input num" defaultValue={defaultAccountNumber} placeholder="Optional" inputMode="numeric" autoComplete="off" />
        </label>
      )}

      {/* What a payer needs to send money in. Copied out together from the
          account list with "Copy details". */}
      {type === 'bank' && (
        <>
          <label className="field">
            <span>Account holder name</span>
            <input name="holder_name" className="input" defaultValue={bank?.holderName ?? ''} placeholder="Name on the account" maxLength={120} />
          </label>
          <label className="field">
            <span>Bank name</span>
            <input name="bank_name" className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. BRAC Bank PLC" maxLength={80} />
          </label>
          <label className="field">
            <span>Routing number</span>
            <input name="routing_number" className="input num" defaultValue={bank?.routingNumber ?? ''} placeholder="9 digits" inputMode="numeric" maxLength={20} autoComplete="off" />
          </label>
        </>
      )}
    </>
  );
}
