# chips-generator

Fun little headless browser script to visit an online poker site regularly to generate free chips

## How it runs

The script does not launch its own browser. It connects over the Chrome DevTools
Protocol to a remote headless Chromium and drives that, which is why the
dependency is `playwright-core` rather than `playwright` (no bundled browser
download, so the box running this needs no browser install of its own).

Set `BROWSER_ENDPOINT` to that browser's CDP address. See `.env.example`.

```sh
bun install
bun index.ts
```

Scheduling, credentials and failure notification are handled outside this repo
by a systemd timer and unit, which pass the environment in via `EnvironmentFile`
rather than a `.env` read by a wrapper script. `run.sh` was removed for that
reason. Logs go to the journal: `journalctl -u chips-generator`.

Both state files, `chips` and `run.log`, are written relative to the working
directory, so the unit sets `WorkingDirectory` to the checkout.
