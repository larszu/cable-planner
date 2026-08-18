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
