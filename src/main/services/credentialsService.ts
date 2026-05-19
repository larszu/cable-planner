import keytar from 'keytar'

const SERVICE_NAME = 'cable-planner'
const ACCOUNT_NAME = 'rentman-api-token'

export const credentialsService = {
  async getToken(): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
  },

  async saveToken(token: string): Promise<boolean> {
    // v7.9.120 — Token-Sanitization: alle Control-Chars, NBSP, BOM
    // raus. Tokens aus PDF/Mail-Copy-Paste haben oft ​/﻿ dabei,
    // was Rentman dann 403-malformed-Authorization-Header gibt.
    // eslint-disable-next-line no-control-regex
    const clean = (token ?? '')
      .replace(/[\u0000-\u001f\u007f-\u00a0\ufeff]/g, '')
      .trim()
      .replace(/^Bearer\s+/i, '')
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, clean)
    return true
  },

  async deleteToken(): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
  },
}
