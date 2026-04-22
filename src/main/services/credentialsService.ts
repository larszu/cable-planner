import keytar from 'keytar'

const SERVICE_NAME = 'cable-planner'
const ACCOUNT_NAME = 'rentman-api-token'

export const credentialsService = {
  async getToken(): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
  },

  async saveToken(token: string): Promise<boolean> {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token.trim())
    return true
  },

  async deleteToken(): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
  },
}
