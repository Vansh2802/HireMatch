import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type ControlProps = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  /** A control element, or a render function for controls wrapped in other markup. */
  children: ReactElement<ControlProps> | ((props: ControlProps) => ReactNode);
  className?: string;
};

/** Label + control + hint/error with correct ids and aria wiring. */
export function Field({ label, hint, error, optional, children, className = '' }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const controlProps: ControlProps = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };
  const control = typeof children === 'function' ? children(controlProps) : isValidElement(children) ? cloneElement(children, controlProps) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-faint">Optional</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-missing" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`control ${className}`} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`control min-h-[6rem] leading-relaxed ${className}`} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`control appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${className}`} style={{ backgroundImage: CHEVRON }} {...props}>
      {children}
    </select>
  );
});

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235C5B56' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;
