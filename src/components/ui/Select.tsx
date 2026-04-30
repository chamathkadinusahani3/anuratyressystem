import React from 'react';
import { ChevronDown } from 'lucide-react';
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: {
    value: string;
    label: string;
  }[];
}
export function Select({
  label,
  options,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label &&
      <label className="block text-sm font-medium text-neutral-400 mb-1.5">
          {label}
        </label>
      }
      <div className="relative">
        <select
          className={`w-full appearance-none bg-black border border-neutral-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] transition-colors disabled:opacity-50 ${className}`}
          {...props}>

          {options.map((opt) =>
          <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )}
        </select>
        <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
      </div>
    </div>);

}