import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary'

/** Munda Manager's `default` and `outline` button variants (components/ui/button.tsx there). */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-gray-800',
  secondary: 'border border-edge bg-card hover:bg-muted',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-neutral-300 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
