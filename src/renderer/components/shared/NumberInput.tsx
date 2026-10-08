import { useState, type InputHTMLAttributes } from 'react'
import { commitNumber, liveNumber } from '../../lib/numberDraft'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'>

export interface NumberInputProps extends NativeProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  integer?: boolean
}

/** Zahlenfeld, das beim Tippen leer sein darf und erst bei blur/Enter klemmt (#1030). */
export const NumberInput = ({ value, onChange, min, max, integer, onBlur, onKeyDown, ...rest }: NumberInputProps) => {
  const [draft, setDraft] = useState<string | null>(null)
  const bounds = { min, max, integer }

  const commit = () => {
    if (draft === null) return
    const n = commitNumber(draft, value, bounds)
    setDraft(null)
    if (n !== value) onChange(n)
  }

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const n = liveNumber(raw, bounds)
        if (n !== null && n !== value) onChange(n)
      }}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        onKeyDown?.(e)
      }}
    />
  )
}
