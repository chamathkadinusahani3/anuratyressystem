import React from 'react';
import { Loader2 } from 'lucide-react';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}
export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
  'inline-flex items-center justify-center rounded-md font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-[#FFD700] text-black hover:bg-[#E6C200] focus:ring-[#FFD700]',
    secondary:
    'bg-neutral-800 text-white hover:bg-neutral-700 focus:ring-neutral-500',
    outline:
    'border-2 border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700] hover:text-black focus:ring-[#FFD700]',
    ghost: 'text-[#FFD700] hover:bg-neutral-900 hover:text-[#E6C200]',
    danger: 'bg-[#FF0000] text-white hover:bg-red-700 focus:ring-red-500'
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-6 text-base'
  };
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}>

      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>);

}