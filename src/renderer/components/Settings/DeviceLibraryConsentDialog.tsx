// ───────────────────────────────────────────────────────────────────────────
// Datenschutz-Dialog: duerfen die eigenen Vorlagen in die Bibliothek?
//
// Er wird gestellt, BEVOR das erste Mal etwas hinausgeht — und nicht als
// Haekchen im Kleingedruckten, sondern als Frage mit zwei Antworten. Was
// hochgeht und was nicht, steht in `lib/deviceLibraryConsent.ts`; dieser
// Dialog zeigt genau diese Liste. Wer ablehnt, behaelt die Bibliothek: das
// Herunterladen ist davon nicht betroffen, und das sagt der Dialog auch.
//
// Keine Vorauswahl, kein „Erlauben" als Hauptknopf mit Ablehnen als Link:
// beide Wege sind gleich erreichbar. Eine Zustimmung, die man wegklickt, ist
// keine.
// ───────────────────────────────────────────────────────────────────────────
import { Check, X } from 'lucide-react'
import { format, useTranslation } from '../../lib/i18n'
import { CONSENT_KEEPS, CONSENT_SENDS } from '../../lib/deviceLibraryConsent'
import { guidelinesUrl } from '../../lib/deviceLibrary'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'

export const DeviceLibraryConsentDialog = ({
  open,
  server,
  erneut,
  onDecide,
  onClose,
}: {
  open: boolean
  server: string
  /** `true`: es gab schon eine Zustimmung, der Umfang hat sich geaendert. */
  erneut?: boolean
  onDecide: (accepted: boolean) => void
  onClose: () => void
}) => {
  const t = useTranslation()
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title={
        erneut
          ? t('deviceLibrary.consent.titleAgain', 'What gets uploaded has changed')
          : t('deviceLibrary.consent.title', 'Share your own devices?')
      }
    >
      <div className="space-y-3 text-cp-xs">
        {/* Kurze Absaetze, nicht ein langer hinter „mehr": was man hier
            erlaubt, muss ohne Aufklappen lesbar sein. Der Waechter
            `tests/hinweisLaenge.test.ts` verlangt deshalb zu Recht etwas,
            das hier genau richtig ist — kurze Saetze. */}
        <p>
          {format(t('deviceLibrary.consent.intro', 'The device library at {server} is a shared catalogue of device types.'), { server })}{' '}
          {t('deviceLibrary.consent.intro2', 'You can use it without contributing anything.')}
        </p>
        <p>
          {t('deviceLibrary.consent.intro3', 'If you allow it, templates you created or changed here are sent there.')}{' '}
          {t('deviceLibrary.consent.intro4', 'Moderation reviews them before anyone else sees them.')}
        </p>

        <div>
          <h3 className="font-medium text-cp-text">{t('deviceLibrary.consent.sendsTitle', 'What is sent')}</h3>
          <ul className="mt-1 space-y-1">
            {CONSENT_SENDS.map((z) => (
              <li key={z.key} className="flex gap-2">
                <span className="mt-[2px] shrink-0 text-cp-text-muted">•</span>
                <span>{t(z.key, z.en)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-medium text-cp-text">{t('deviceLibrary.consent.keepsTitle', 'What stays here')}</h3>
          <ul className="mt-1 space-y-1">
            {CONSENT_KEEPS.map((z) => (
              <li key={z.key} className="flex gap-2">
                <span className="mt-[2px] shrink-0 text-cp-ok">•</span>
                <span>{t(z.key, z.en)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-cp-text-muted">
          {t('deviceLibrary.consent.reversible', 'You can withdraw this at any time in the settings; nothing further is uploaded then.')}
        </p>
        <p className="text-cp-text-muted">
          {t('deviceLibrary.consent.reversible2', 'Entries already released stay in the library — other people plan with them.')}{' '}
          {t('deviceLibrary.consent.reversible3', 'Deleting one is a request to moderation.')}
        </p>
        <p className="text-cp-text-muted">
          {t('deviceLibrary.consent.declineOk', 'If you decline, you keep fetching and updating devices from the library. Only the upload stays off.')}
        </p>
        <a
          href={guidelinesUrl(server)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-cp-accent hover:underline"
        >
          {t('deviceLibrary.consent.guidelines', 'Community guidelines and privacy notice')}
        </a>

        <div className="flex flex-wrap gap-2 border-t border-cp-border-muted pt-3">
          <button
            type="button"
            onClick={() => onDecide(true)}
            className="inline-flex items-center gap-1 bg-cp-accent px-3 py-1 text-cp-xs text-cp-accent-text"
          >
            <Icon icon={Check} size="xs" /> {t('deviceLibrary.consent.allow', 'Allow uploading')}
          </button>
          <button
            type="button"
            onClick={() => onDecide(false)}
            className="inline-flex items-center gap-1 border border-cp-border bg-cp-surface-3 px-3 py-1 text-cp-xs hover:bg-cp-surface-4"
          >
            <Icon icon={X} size="xs" /> {t('deviceLibrary.consent.decline', 'Do not upload')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
