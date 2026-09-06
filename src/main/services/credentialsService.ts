import keytar from 'keytar'

const SERVICE_NAME = 'cable-planner'
const ACCOUNT_NAME = 'rentman-api-token'
/** #597 — NetBox-Token liegt im gleichen Keychain-Service, aber unter
 *  eigenem Account. Getrennt von Rentman, damit das Loeschen der einen
 *  Integration die andere nicht mitnimmt. */
const NETBOX_ACCOUNT_NAME = 'netbox-api-token'

/** Tokens kommen fast immer aus Copy-Paste (Mail, PDF, Browser) und
 *  schleppen unsichtbare Zeichen mit: BOM, NBSP, Zero-Width-Spaces,
 *  Bidi-Marks, Control-Chars. Wir behalten nur printable ASCII
 *  (0x21–0x7e) — Rentman-JWTs wie NetBox-Hex-Tokens liegen komplett
 *  darin — und strippen ein versehentlich mitkopiertes Auth-Prefix. */
const sanitizeToken = (token: string | null | undefined): string =>
  (token ?? '').replace(/[^!-~]/g, '').replace(/^(Bearer|Token)\s*/i, '')

export const credentialsService = {
  async getToken(): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
  },

  async saveToken(token: string): Promise<boolean> {
    // v7.9.121 — STRENGE Sanitization: keep ONLY printable ASCII
    // (0x21-0x7e). Strippt Zero-Width-Spaces, Bidi-Marks und alles
    // andere was meine v7.9.120-Regex (control chars + NBSP + BOM)
    // noch durchgelassen hat. Tokens sind base64/hex/JWT — alle ASCII.
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, sanitizeToken(token))
    return true
  },

  async deleteToken(): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
  },
}

/**
 * #597 — NetBox-API-Token im OS-Schlüsselbund.
 *
 * Anders als bei Rentman gibt der Renderer das Token nie wieder zurück:
 * er fragt nur `hasToken()`. Das Token verlässt den Main-Prozess nicht,
 * es wird ausschliesslich für ausgehende NetBox-Requests genutzt.
 */
export const netboxCredentialsService = {
  async getToken(): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, NETBOX_ACCOUNT_NAME)
  },

  async hasToken(): Promise<boolean> {
    const token = await keytar.getPassword(SERVICE_NAME, NETBOX_ACCOUNT_NAME)
    return Boolean(token)
  },

  async saveToken(token: string): Promise<boolean> {
    const clean = sanitizeToken(token)
    if (!clean) {
      await keytar.deletePassword(SERVICE_NAME, NETBOX_ACCOUNT_NAME)
      return false
    }
    await keytar.setPassword(SERVICE_NAME, NETBOX_ACCOUNT_NAME, clean)
    return true
  },

  async deleteToken(): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, NETBOX_ACCOUNT_NAME)
  },
}

/**
 * Initiative 9 — Stream-Keys der Ausspielziele.
 *
 * Ein Stream-Key ist ein Geheimnis mit unmittelbarer Wirkung: wer ihn hat,
 * sendet auf den Kanal des Kunden. `CLAUDE.md` schreibt fuer externe Tokens
 * den OS-Schluesselbund vor („niemals loggen oder ins Projekt-File
 * schreiben"), und fuer diesen gilt es doppelt: eine `.avplan` wandert per
 * Mail, liegt in Dropbox, geht in den Mobile-Viewer und in den Web-Viewer.
 *
 * EIN ACCOUNT JE ZIEL (`stream-key:<id>`), nicht ein Blob fuer alle: sonst
 * nimmt das Loeschen eines Ziels entweder alle Keys mit oder keinen.
 *
 * Der Klartext GEHT an den Renderer zurueck — anders als beim NetBox-Token.
 * Das ist Absicht und kein Rueckschritt: der Techniker muss den Key in OBS
 * oder vMix einfuegen koennen, und ein Geheimnis, das man nicht mehr
 * herausbekommt, wird daneben in eine Textdatei geschrieben. Der Unterschied
 * zum Projekt-File bleibt der entscheidende: der Schluesselbund wandert nicht
 * mit der Datei.
 */
const STREAM_KEY_PREFIX = 'stream-key:'

/** Ein Ziel-Id ist eine UUID aus dem Renderer. Trotzdem geprueft, bevor sie
 *  zum Schluesselbund-Account wird: ein Account-Name aus ungeprueftem Text
 *  koennte einen fremden Eintrag adressieren -- etwa den Rentman-Token. */
const isSafeDestinationId = (id: string): boolean => /^[A-Za-z0-9_-]{1,64}$/.test(id)

const accountFor = (destinationId: string): string => {
  if (!isSafeDestinationId(destinationId)) {
    throw new Error('Invalid destination id.')
  }
  return STREAM_KEY_PREFIX + destinationId
}

export const streamKeyService = {
  async get(destinationId: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, accountFor(destinationId))
  },

  async has(destinationId: string): Promise<boolean> {
    return Boolean(await keytar.getPassword(SERVICE_NAME, accountFor(destinationId)))
  },

  async save(destinationId: string, key: string): Promise<boolean> {
    const account = accountFor(destinationId)
    const clean = sanitizeToken(key)
    if (!clean) {
      // Ein geleertes Feld heisst „loeschen". Einen leeren String abzulegen
      // ergaebe ein Ziel, das einen Key BEHAUPTET und keinen hat.
      await keytar.deletePassword(SERVICE_NAME, account)
      return false
    }
    await keytar.setPassword(SERVICE_NAME, account, clean)
    return true
  },

  async delete(destinationId: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, accountFor(destinationId))
  },
}
