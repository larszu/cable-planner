// #1068 — fertige Kopiervorlagen fuer den MCP-Reiter.
const NAME = 'cable-planner'

export const claudeMcpAddBefehl = (url: string, token: string): string =>
  `claude mcp add --transport http ${NAME} ${url} --header "Authorization: Bearer ${token}"`

export const mcpJsonKonfig = (url: string, token: string): string =>
  JSON.stringify(
    { mcpServers: { [NAME]: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  )

/** Fuer Sitzungen, die keinen Server nachladen koennen: JSON-RPC direkt. */
export const mcpCurlBeispiel = (url: string, token: string): string =>
  [
    `curl -s ${url} \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Accept: application/json, text/event-stream" \\`,
    `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  ].join('\n')
