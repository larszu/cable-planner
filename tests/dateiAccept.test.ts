import { describe, expect, it } from 'vitest'
import { dateiAccept, istIOS } from '../src/renderer/lib/dateiAccept'

// #1197 — .cableplan liess sich am iPhone nicht oeffnen.
const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }
const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }
const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }

describe('Dateiauswahl auf iOS', () => {
  it('erkennt iPhone und iPadOS', () => {
    expect(istIOS(iphone)).toBe(true)
    expect(istIOS(ipad)).toBe(true)
    expect(istIOS(mac)).toBe(false)
  })
  it('laesst accept auf iOS weg, sonst bleibt es', () => {
    expect(dateiAccept('.cableplan,.json', iphone)).toBe('')
    expect(dateiAccept('.cableplan,.json', mac)).toBe('.cableplan,.json')
  })
})
