// #1030 — Zahlenfelder ließen sich nicht leeren: Backspace setzte sofort 1,
// die nächste Ziffer wurde angehängt (1 → 11 HE, Rackhöhe 6 → 16).
import { describe, expect, it, afterEach } from 'vitest'
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { commitNumber, liveNumber } from '../src/renderer/lib/numberDraft'
import { NumberInput } from '../src/renderer/components/shared/NumberInput'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('numberDraft', () => {
  it('übernimmt beim Tippen nur gültige Werte', () => {
    expect(liveNumber('', { min: 1 })).toBeNull()
    expect(liveNumber('0', { min: 1 })).toBeNull()
    expect(liveNumber('49', { min: 1, max: 48 })).toBeNull()
    expect(liveNumber('16', { min: 1, max: 48 })).toBe(16)
    expect(liveNumber('2.7', { integer: true })).toBe(2)
  })

  it('klemmt beim Verlassen, leer fällt auf den alten Wert zurück', () => {
    expect(commitNumber('', 6, { min: 1 })).toBe(6)
    expect(commitNumber('0', 6, { min: 1 })).toBe(1)
    expect(commitNumber('99', 6, { min: 1, max: 48 })).toBe(48)
    expect(commitNumber('abc', 6)).toBe(6)
  })
})

describe('NumberInput', () => {
  let root: Root | undefined
  afterEach(() => {
    act(() => root?.unmount())
    document.body.innerHTML = ''
  })

  const mount = (initial: number, max?: number) => {
    const seen: number[] = []
    const Harness = () => {
      const [v, setV] = useState(initial)
      return createElement(NumberInput, {
        value: v,
        min: 1,
        max,
        onChange: (n: number) => {
          seen.push(n)
          setV(n)
        },
      })
    }
    const host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root!.render(createElement(Harness)))
    const input = host.querySelector('input')!
    const type = (text: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    return { input, seen, type }
  }

  it('lässt das Feld leer und hängt nicht an (6 → leer → 16, nicht 116)', () => {
    const { input, seen, type } = mount(6, 48)
    type('')
    expect(input.value).toBe('')
    type('1')
    type('16')
    expect(input.value).toBe('16')
    expect(seen).toEqual([1, 16])
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.value).toBe('16')
  })

  it('stellt beim Verlassen eines leeren Felds den Wert wieder her und klemmt', () => {
    const { input, seen, type } = mount(6, 48)
    type('')
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(input.value).toBe('6')
    type('99')
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(input.value).toBe('48')
    expect(seen).toEqual([48])
  })
})
