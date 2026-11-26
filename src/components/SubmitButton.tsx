'use client';

import { useFormStatus } from 'react-dom';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingLabel?: string;
}

// Disabled while its form is submitting. Without it a second tap on a slow
// connection records the same expense twice.
export function SubmitButton({ children, pendingLabel = 'Saving…', className = 'btn-primary', disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}
