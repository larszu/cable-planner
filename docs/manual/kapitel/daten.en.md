## Data, safety and troubleshooting

- **Projects**: local JSON files. The app writes them atomically with a backup
  copy.
- **App data** (library, recent projects, settings) lives in the app-data
  folder `Cable Planner`.
- **Secrets** (API tokens, stream credentials, device library sign-in) live in
  the operating system's keychain. The web edition keeps the device library
  sign-in in the browser's storage.
- **"No recovery copy"** in the status bar: save the project to a file.
- **No still image preview**: install ffmpeg, and check the device is in the
  local network.
- **Device library unreachable**: the app keeps working with the devices from
  the last sync.

Questions and bug reports:
[GitHub Issues](https://github.com/larszu/cable-planner/issues).


© 2026 Lars Zumpe Medienproduktion · free to use, proprietary licence
