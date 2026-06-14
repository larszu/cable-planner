// Phase 1 — Einheitlicher Icon-Wrapper über lucide-react.
//
// Vorher: funktionale Icons waren Emojis (✕, ⚠, ✎, ⇢/⇠ …), die je nach
// Plattform/Font inkonsistent rendern. Jetzt: echte SVG-Icons mit
// einheitlichen Größen-, Stroke- und Farb-Defaults.
//
// Farbe kommt per `currentColor` aus der umgebenden Text-Klasse
// (z. B. text-cp-text-muted) — dadurch sind Icons automatisch theme-aware,
// ohne dass eine eigene Farb-Prop nötig ist.

import type { LucideIcon, LucideProps } from 'lucide-react'

/** Benannte Größen-Tokens (px). Kleinster Wert 12px = absolute
 *  Mindestgröße, passend zur Typo-Skala. */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
}

export interface IconProps extends Omit<LucideProps, 'size' | 'ref' | 'aria-label'> {
  /** Das zu rendernde lucide-Icon (z. B. `X`, `AlertTriangle`). */
  icon: LucideIcon
  /** Größen-Token oder roher px-Wert. Default 'sm' (14px). */
  size?: IconSize | number
  /** Wenn gesetzt → Icon ist für Screenreader sichtbar (`role="img"`).
   *  Ohne label ist das Icon rein dekorativ und `aria-hidden`
   *  (Default), weil der umgebende Button/Text die Bedeutung trägt. */
  label?: string
}

/**
 * Dünner Wrapper um lucide-Icons mit einheitlichen Defaults.
 *
 * - Icon-only-Buttons: `aria-label` gehört an den Button, das Icon
 *   bleibt dekorativ (kein label hier).
 * - Standalone-Icon mit Bedeutung: `label` setzen → wird zu `role="img"`.
 */
export const Icon = ({
  icon: IconCmp,
  size = 'sm',
  label,
  strokeWidth = 2,
  ...rest
}: IconProps) => {
  const px = typeof size === 'number' ? size : SIZE_PX[size]
  return (
    <IconCmp
      width={px}
      height={px}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...rest}
    />
  )
}
