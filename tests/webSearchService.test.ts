import { describe, expect, it } from 'vitest'
import { htmlToText, parseDdgHtml } from '../src/main/services/webSearchService'

describe('webSearchService', () => {
  it('liest Titel, Ziel-URL und Schnipsel aus der DDG-Ergebnisseite', () => {
    const html = `<div class="result results_links"><div class="result__body">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fpixelhue.com%2Fp20&amp;rut=x">PIXELHUE <b>P20</b></a>
      <a class="result__snippet" href="#">4 x HDMI 2.0 inputs &amp; 2 x 12G-SDI outputs</a></div></div>`
    expect(parseDdgHtml(html)).toEqual([
      { title: 'PIXELHUE P20', url: 'https://pixelhue.com/p20', snippet: '4 x HDMI 2.0 inputs & 2 x 12G-SDI outputs' },
    ])
  })

  it('liefert bei fremdem Markup eine leere Liste statt eines Fehlers', () => {
    expect(parseDdgHtml('<html>nichts</html>')).toEqual([])
  })

  it('wirft Skripte und Navigation aus dem Seitentext', () => {
    const text = htmlToText('<nav>HDMI Zubehoer</nav><script>x()</script><p>2 SDI inputs</p>')
    expect(text).toContain('2 SDI inputs')
    expect(text).not.toMatch(/Zubehoer|x\(\)/)
  })
})
