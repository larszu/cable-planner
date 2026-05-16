export default function SelfHostingPage() {
  return (
    <>
      <h1>Self-Hosting</h1>

      <p>
        EasySchematic can be self-hosted using Docker. The container builds the
        frontend from source and serves it with nginx. All offline features work
        exactly the same as the hosted version at{" "}
        <a href="https://easyschematic.live">easyschematic.live</a>.
      </p>

      <div
        className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r my-4"
        role="note"
      >
        <strong>Note:</strong> Cloud features — save to cloud, device
        submissions, shared links — communicate with the hosted API at{" "}
        <code>api.easyschematic.live</code>. The API runs on Cloudflare Workers
        and is not included in the Docker image. No account or API key is
        required for read-only access (browsing the device library, loading
        shared schematics).
      </div>

      <h2>Quick start</h2>

      <pre>
        <code>{`git clone https://github.com/duremovich/EasySchematic.git
cd EasySchematic
docker compose up -d`}</code>
      </pre>

      <p>
        Open <a href="http://localhost:8080">http://localhost:8080</a> in your
        browser. The first build takes a few minutes while npm installs
        dependencies and Vite bundles the app.
      </p>

      <h2>Docker commands</h2>

      <p>
        A <code>makefile</code> wraps common Docker Compose commands:
      </p>

      <table>
        <thead>
          <tr>
            <th>Command</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>make build</code>
            </td>
            <td>Build the Docker image</td>
          </tr>
          <tr>
            <td>
              <code>make up</code>
            </td>
            <td>Start the container (port 8080)</td>
          </tr>
          <tr>
            <td>
              <code>make down</code>
            </td>
            <td>Stop the container</td>
          </tr>
          <tr>
            <td>
              <code>make restart</code>
            </td>
            <td>Restart the container</td>
          </tr>
          <tr>
            <td>
              <code>make logs</code>
            </td>
            <td>Tail container logs</td>
          </tr>
          <tr>
            <td>
              <code>make build-clean</code>
            </td>
            <td>Rebuild with no cache</td>
          </tr>
        </tbody>
      </table>

      <p>
        Or use <code>docker compose</code> directly — the makefile is just a
        convenience wrapper.
      </p>

      <h2>Changing the port</h2>

      <p>
        Edit <code>compose.yml</code> and change the first number in the port
        mapping:
      </p>

      <pre>
        <code>{`ports:
  - "3000:80"  # now available at localhost:3000`}</code>
      </pre>

      <h2>Reverse proxy</h2>

      <p>
        To serve EasySchematic behind a reverse proxy (nginx, Caddy, Traefik),
        point the proxy at the container's port and ensure it forwards
        WebSocket-upgrade headers if you plan to use live reload during
        development. For production, a simple HTTP proxy is sufficient since the
        container serves static files only.
      </p>

      <p>Example Caddy config:</p>

      <pre>
        <code>{`easyschematic.example.com {
    reverse_proxy localhost:8080
}`}</code>
      </pre>

      <h2>What works offline</h2>

      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Works in Docker</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Canvas editing, device placement, connections</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Bundled offline device templates (~780)</td>
            <td>Yes (bundled at build time; live community library still loads when the hosted API is reachable)</td>
          </tr>
          <tr>
            <td>Export (PNG, SVG, DXF, PDF, JSON)</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Import (JSON, CSV cable schedule)</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Pack list, cable schedule, reports</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Auto-save to browser localStorage</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Print with title block</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Save to cloud</td>
            <td>Requires account (uses hosted API)</td>
          </tr>
          <tr>
            <td>Device submissions</td>
            <td>Requires account (uses hosted API)</td>
          </tr>
          <tr>
            <td>Shared links</td>
            <td>Requires hosted API</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
