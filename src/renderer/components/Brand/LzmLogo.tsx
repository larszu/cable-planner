import hauptlogoNavy from '../../assets/brand/lzm_hauptlogo_navy.svg'
import hauptlogoOffwhite from '../../assets/brand/lzm_hauptlogo_offwhite.svg'
import { APP_COMPANY } from '../../lib/appInfo'


/**
 * The signet is drawn inline so its colour is the `--cp-logo` token: Navy on
 * light, Off-White on dark — kit colours only, never the UI accent (design
 * contract 2026-10). The tally dot is always the signal red. Paths are the
 * kit file `lzm_signet_navy_tally.svg`, unchanged.
 */
const Signet = ({ height = 32 }: { height?: number }) => (
  <svg
    className="lzm-logo__signet"
    viewBox="478.129 455.570 234.046 139.875"
    height={height}
    width={(height * 234.046) / 139.875}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fillRule="nonzero"
      d="M 478.128906 595.445312 L 505.285156 455.570312 L 540.207031 455.570312 L 513.046875 595.445312 Z M 478.128906 595.445312  M638.277 595.445 L555.828 595.445 L561.062 568.285 L610.922 521.727 L570.183 521.727 L575.422 494.566 L657.871 494.566 L652.633 521.727 L602.773 568.285 L643.515 568.285 Z M638.277 595.445"
      fill="var(--cp-logo)"
    />
    <path d="M677.011 595.445 681.538 565.865 H712.175 L707.647 595.445 Z" fill="var(--cp-signal)" />
  </svg>
)

/** Brand Guide 2.0 allows only Navy on light and Off-White on dark. The
 *  signet follows `--cp-logo`; the main logo swaps the two kit files in CSS. */
export const LzmLogo = ({
  variant,
  height,
  width,
}: {
  variant: 'signet' | 'hauptlogo'
  height?: number
  width?: number
}) => (
  <span className={`lzm-logo lzm-logo--${variant}`} role="img" aria-label={APP_COMPANY}>
    {variant === 'signet' ? (
      <Signet height={height} />
    ) : (
      <>
        <img className="lzm-logo__navy" src={hauptlogoNavy} height={height} width={width} alt="" draggable={false} />
        <img className="lzm-logo__offwhite" src={hauptlogoOffwhite} height={height} width={width} alt="" draggable={false} />
      </>
    )}
  </span>
)
