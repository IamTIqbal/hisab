'use client';

import { useFormStatus } from 'react-dom';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  message?: string;
}

export function ConfirmButton({ message = 'Are you sure?', onClick, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      disabled={pending || disabled}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
        onClick?.(e);
      }}
    />
  );
}
