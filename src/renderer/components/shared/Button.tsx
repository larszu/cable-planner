// Shared Button — single source of truth for button styling (UX audit #48).
//
// The app had ~510 hand-styled <button>s with no shared component: primary
// actions were spelled emerald / sky / indigo interchangeably and vertical
// padding ranged py-0.5…py-1.5 for identical roles. This component fixes the
// variant colors, sizes, focus, disabled and transition in one place so call
// sites converge. Colors use Tailwind classes that the light-theme remap in
// index.css already covers, so buttons are theme-aware.

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

// Design-Vertrag 2026-10: Hauptknopf als Pill im Akzent, Sekundaer „soft"
// (Akzent weich), dazu Ghost. Keine 2-px-Outline-Knoepfe mehr.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'rounded-cp-full bg-cp-accent text-cp-accent-text shadow-cp-1 hover:bg-cp-accent-hover hover:shadow-cp-2 font-semibold',
  secondary: 'rounded-cp-control bg-cp-accent-soft text-cp-text-bright hover:bg-cp-surface-4',
  success: 'rounded-cp-control bg-cp-ok text-white hover:brightness-110',
  danger: 'rounded-cp-control bg-cp-danger text-white hover:brightness-110',
  ghost: 'rounded-cp-control bg-transparent text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1 text-cp-xs gap-1',
  md: 'min-h-9 px-4 py-1.5 text-cp-sm gap-1.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Optional leading lucide icon. */
  leftIcon?: LucideIcon
  /** Optional trailing lucide icon. */
  rightIcon?: LucideIcon
  /** Stretch to fill the container width. */
  fullWidth?: boolean
}

/**
 * Shared button. Defaults to `type="button"` (so it never submits a form by
 * accident) and `variant="secondary"`. Focus ring comes from the global
 * :focus-visible rule in index.css.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'sm',
    leftIcon,
    rightIcon,
    fullWidth,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const iconSize = size === 'md' ? 'sm' : 'xs'
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        VARIANT_CLASS[variant]
      } ${SIZE_CLASS[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {leftIcon && <Icon icon={leftIcon} size={iconSize} />}
      {children}
      {rightIcon && <Icon icon={rightIcon} size={iconSize} />}
    </button>
  )
})
