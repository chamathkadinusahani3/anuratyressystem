import React from 'react';
type BadgeVariant =
'pending' |
'progress' |
'completed' |
'cancelled' |
'default';
interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}
export function Badge({
  children,
  variant = 'default',
  className = ''
}: BadgeProps) {
  const variants = {
    default: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    pending: 'bg-yellow-900/30 text-[#FFD700] border-[#FFD700]/30',
    progress: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
    completed: 'bg-green-900/30 text-green-400 border-green-500/30',
    cancelled: 'bg-red-900/30 text-[#FF0000] border-[#FF0000]/30'
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>

      {children}
    </span>);

}