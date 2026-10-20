// #1068 — was vom MCP-Schalter einen Neustart ueberlebt.
//
// Port, „Server an" und „Schreiben erlaubt" stehen in einer eigenen Datei im
// userData-Ordner; ein Eintrag in `~/.claude.json` zeigte sonst nach jedem
// Start ins Leere. Das Token bleibt im Schluesselbund (credentialsService).
import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from '../util/atomicWrite.js'
import { normalisiereMcpEinstellungen, type McpEinstellungen } from './mcpEinstellungenForm.js'

const datei = (): string => path.join(app.getPath('userData'), 'mcp-settings.json')

export const ladeMcpEinstellungen = async (): Promise<McpEinstellungen> => {
  try {
    return normalisiereMcpEinstellungen(JSON.parse(await readFile(datei(), 'utf8')))
  } catch {
    return normalisiereMcpEinstellungen(null)
  }
}

export const speichereMcpEinstellungen = async (
  teil: Partial<McpEinstellungen>,
): Promise<McpEinstellungen> => {
  const neu = normalisiereMcpEinstellungen({ ...(await ladeMcpEinstellungen()), ...teil })
  await atomicWriteFile(datei(), JSON.stringify(neu, null, 2), { backup: false })
  return neu
}
