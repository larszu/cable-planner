import hauptlogoNavy from '../../assets/brand/lzm_hauptlogo_navy.svg'
import hauptlogoOffwhite from '../../assets/brand/lzm_hauptlogo_offwhite.svg'
import signetNavy from '../../assets/brand/lzm_signet_navy_tally.svg'
import signetOffwhite from '../../assets/brand/lzm_signet_offwhite_tally.svg'
import { APP_COMPANY } from '../../lib/appInfo'

const QUELLEN = {
  signet: { navy: signetNavy, offwhite: signetOffwhite },
  hauptlogo: { navy: hauptlogoNavy, offwhite: hauptlogoOffwhite },
} as const

/** Brand Guide 2.0 allows only Navy on light and Off-White on dark; the
 *  theme switch happens in CSS (`.lzm-logo`), so both files are rendered. */
export const LzmLogo = ({
  variant,
  height,
  width,
}: {
  variant: keyof typeof QUELLEN
  height?: number
  width?: number
}) => (
  <span className={`lzm-logo lzm-logo--${variant}`} role="img" aria-label={APP_COMPANY}>
    <img className="lzm-logo__navy" src={QUELLEN[variant].navy} height={height} width={width} alt="" draggable={false} />
    <img className="lzm-logo__offwhite" src={QUELLEN[variant].offwhite} height={height} width={width} alt="" draggable={false} />
  </span>
)
