# chips-generator

Fun little headless browser script to visit an online poker site regularly to generate free chips

## How it runs

The script does not launch its own browser. It connects over the Chrome DevTools
Protocol to a remote headless Chromium and drives that, which is why the
dependency is `playwright-core` rather than `playwright` (no bundled browser
download, so the box running this needs no browser install of its own).

Set `BROWSER_ENDPOINT` to that browser's CDP address. See `.env.example`.

```sh
npm install
npx tsx index.ts
```

### Why node and not bun

Bun's websocket client cannot complete Chromium's CDP handshake. It rejects the
`101` upgrade response and `connectOverCDP` times out after 30s, both when
Playwright discovers the `ws://` URL itself and when it is passed one directly.
The same script under node connects, opens a context and drives a page fine, so
this is a bun limitation rather than anything about the CDP setup.

Node 20 (what Debian 13 ships) cannot execute TypeScript directly, so `tsx` does
the type stripping. Node 22+ could use `--experimental-strip-types` instead and
drop that dependency.

Scheduling, credentials and failure notification are handled outside this repo
by a systemd timer and unit, which pass the environment in via `EnvironmentFile`
rather than a `.env` read by a wrapper script. `run.sh` was removed for that
reason. Logs go to the journal: `journalctl -u chips-generator`.

Both state files, `chips` and `run.log`, are written relative to the working
directory, so the unit sets `WorkingDirectory` to the checkout.
