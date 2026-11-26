'use client';

import { useState } from 'react';

// Copies `text` and says so on the button for a moment. Falls back to a
// hidden textarea where the async clipboard API is unavailable (older
// Android WebViews, plain-http dev servers).
export function CopyButton({ text, label, className = 'btn-secondary btn-sm' }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    setState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setState('idle'), 1800);
  }

  return (
    <button type="button" className={className} onClick={copy} data-state={state}>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : label}</span>
    </button>
  );
}
