// Shared busy spinner (UX audit #44). The app had almost no loading
// feedback — long ops (export, Rentman sync, AI, Videohub send) gave no
// visual sign of work. This is a single lucide-based spinner that honours
// prefers-reduced-motion (the animate-spin is dropped via the global
// reduced-motion rule in index.css).

import { Loader2 } from 'lucide-react'
import { Icon, type IconSize } from './Icon'

export const Spinner = ({
  size = 'sm',
  className = '',
}: {
  size?: IconSize | number
  className?: string
}) => <Icon icon={Loader2} size={size} className={`animate-spin ${className}`} />
