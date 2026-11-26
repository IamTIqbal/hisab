export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="notice notice-error">
      {message}
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="notice notice-ok">
      {children}
    </div>
  );
}
