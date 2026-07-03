import { forwardRef, type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm text-mist-300">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={`w-full rounded-lg border bg-ink-800 px-4 py-2.5 text-mist-100 placeholder:text-mist-500 transition focus:border-royal-500 ${
          error ? "border-red-500/70" : "border-ink-600"
        } ${className}`}
        {...rest}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
});
