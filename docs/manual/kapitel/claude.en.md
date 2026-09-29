## Claude (MCP)

Claude can answer questions about the open plan — devices, ports, signal paths,
cables and the plan check.

**On this computer**

1. *Settings → MCP* → switch on. The server listens on `127.0.0.1` only and
   uses a pairing token from the keychain.
2. Copy the command shown there, for example:

   ```
   claude mcp add --transport http cable-planner http://127.0.0.1:<port>/mcp --header "Authorization: Bearer <token>"
   ```

3. Reading is the default. **Writing** is a second switch: Claude can then
   connect and remove cables, set cable details and rename devices. Each call
   is one undo step and is listed under *What Claude changed*.

**From claude.ai, the phone or another machine**

1. Put the project into the cloud (*File → Cloud & share link…*).
2. In claude.ai: *Settings → Connectors → Add custom connector* with
   `https://devices.zumpelars.de/mcp` and sign in with your device library
   account.
3. Read-only, over your own cloud projects. Disconnect under *Account →
   Security → Connected apps* on devices.zumpelars.de.

Switching commands for ATEM or Videohub are never offered.
