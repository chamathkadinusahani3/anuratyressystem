import React from 'react';
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label &&
      <label className="block text-sm font-medium text-neutral-400 mb-1.5">
          {label}
        </label>
      }
      <input
        className={`w-full bg-black border border-neutral-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] transition-colors disabled:opacity-50 ${error ? 'border-[#FF0000] focus:border-[#FF0000] focus:ring-[#FF0000]' : ''} ${className}`}
        {...props} />

      {error && <p className="mt-1 text-xs text-[#FF0000]">{error}</p>}
    </div>);

}