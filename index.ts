import { chromium } from "playwright-core";
import fs from "fs";

interface Account {
	label: string;
	username: string;
	password: string;
	storageKey: string;
}

function output(level: "log" | "warn" | "error", message: string) {
	for (const line of message.split("\n")) {
		console[level](`${new Date().toISOString()} ${line}`);
	}
}

function envValue(name: string) {
	const raw = process.env[name];
	if (raw === undefined) return raw;
	const trimmed = raw.trim();
	// Strip one matching pair of wrapping quotes (shell-style .env quoting),
	// not every quote character in the value: stripping every quote corrupts
	// JSON values like ACCOUNTS, which legitimately contain many quotes.
	const wrapped = /^(["'])([\s\S]*)\1$/.exec(trimmed);
	return wrapped ? wrapped[2] : trimmed;
}

function requiredEnv(name: string) {
	const value = envValue(name);
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function numberEnv(name: string, defaultValue: number) {
	const value = envValue(name);
	if (!value) return defaultValue;
	const parsedValue = Number(value);
	if (!Number.isInteger(parsedValue) || parsedValue < 0) {
		throw new Error(`${name} must be a non-negative integer in milliseconds.`);
	}
	return parsedValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function accountString(account: Record<string, unknown>, field: "username" | "password", index: number) {
	const value = account[field];
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`ACCOUNTS[${index}].${field} must be a non-empty string.`);
	}
	return value.trim();
}

function storageKeyFor(label: string) {
	const storageKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	if (!storageKey) throw new Error(`Account label "${label}" cannot be used as a storage key.`);
	return storageKey;
}

function accountsFromEnv(): Account[] {
	const accountsValue = envValue("ACCOUNTS");
	if (!accountsValue) {
		const username = requiredEnv("USERNAME");
		return [{ label: username, username, password: requiredEnv("PASSWORD"), storageKey: storageKeyFor(username) }];
	}

	let parsedAccounts: unknown;
	try {
		parsedAccounts = JSON.parse(accountsValue);
	} catch (error) {
		throw new Error(`ACCOUNTS must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!Array.isArray(parsedAccounts) || parsedAccounts.length === 0) {
		throw new Error("ACCOUNTS must be a non-empty JSON array.");
	}

	const storageKeys = new Set<string>();
	return parsedAccounts.map((rawAccount, index) => {
		if (!isRecord(rawAccount)) throw new Error(`ACCOUNTS[${index}] must be an object.`);
		const username = accountString(rawAccount, "username", index);
		const label = typeof rawAccount.label === "string" && rawAccount.label.trim() ? rawAccount.label.trim() : username;
		const storageKey = storageKeyFor(label);
		if (storageKeys.has(storageKey)) {
			throw new Error(`Account labels must produce unique storage keys. Duplicate: ${storageKey}`);
		}
		storageKeys.add(storageKey);
		return { label, username, password: accountString(rawAccount, "password", index), storageKey };
	});
}

const config = {
	baseUrl: requiredEnv("BASE_URL"),
	accounts: accountsFromEnv(),
	minDelayMs: numberEnv("MIN_DELAY_MS", 1_000),
	maxDelayMs: numberEnv("MAX_DELAY_MS", 300_000),
	// CDP endpoint of the shared headless Chromium instance, e.g.
	// http://192.168.178.161:3000. This script does not launch a browser of its
	// own, which is why the dependency is playwright-core (no bundled browser).
	browserEndpoint: requiredEnv("BROWSER_ENDPOINT"),
};

if (config.minDelayMs > config.maxDelayMs) throw new Error("MIN_DELAY_MS must not be greater than MAX_DELAY_MS.");

function wait(milliseconds: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function randomDelay() {
	return Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs + 1)) + config.minDelayMs;
}

function formatDuration(milliseconds: number) {
	const totalSeconds = Math.floor(milliseconds / 1_000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function normalizeChips(chipsText: string) {
	const chips = chipsText.replace(/\D/g, "");
	if (!chips) throw new Error(`Could not parse chips count from text: ${chipsText}`);
	return chips;
}

function updateChips(account: Account, newChips: string) {
	fs.mkdirSync("account-chips", { recursive: true });
	const chipsPath = `account-chips/${account.storageKey}.txt`;
	const oldChips = fs.existsSync(chipsPath) ? fs.readFileSync(chipsPath, "utf8").trim() : undefined;
	output("log", `[${account.label}] Updating chips from ${oldChips || "none"} to ${newChips}`);
	fs.writeFileSync(chipsPath, `${newChips}\n`);
}

function logRun(account: Account, newChips: string) {
	fs.appendFileSync("run.log", `${new Date().toISOString()} account=${account.label} chips=${newChips}\n`);
	output("log", `[${account.label}] Saved result.`);
}

async function runAccount(browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>, account: Account) {
	// A dedicated context per account, rather than reusing the browser's
	// default one. The remote Chromium is long-lived and shared with other
	// automations, so this keeps each account's session out of the shared
	// profile and starts every run from a clean cookie jar.
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		output("log", `[${account.label}] Navigating to ${config.baseUrl}`);
		await page.goto(config.baseUrl);
		await page.locator("#login").fill(account.username);
		await page.locator("#password").fill(account.password);
		await page.getByRole("button", { name: "Log in" }).click();

		try {
			await page.locator(".inApp-close").click({ timeout: 3_000 });
		} catch {
			// The popup is optional.
		}

		await wait(4_000);
		const chipsText = await page.locator(".header-user-chips").textContent({ timeout: 15_000 });
		if (!chipsText) throw new Error(`Could not find chips count after login. Current URL: ${page.url()}`);

		const newChips = normalizeChips(chipsText);
		updateChips(account, newChips);
		logRun(account, newChips);
		output("log", `[${account.label}] Automation completed.`);
		return { label: account.label, chips: newChips };
	} finally {
		// Close our own context but leave the browser running: it is a shared,
		// long-lived instance owned by the headless-chrome host, and closing it
		// would tear it down for every other consumer. Disconnecting only drops
		// this client's CDP session.
		await context.close();
	}
}

async function run() {
	output("log", `Connecting to remote browser at ${config.browserEndpoint}`);
	const browser = await chromium.connectOverCDP(config.browserEndpoint);
	const failedAccounts: string[] = [];
	const successfulAccounts: Array<{ label: string; chips: string }> = [];
	try {
		for (const [index, account] of config.accounts.entries()) {
			if (index > 0) {
				const delay = randomDelay();
				output("log", `Waiting ${formatDuration(delay)} (${delay}ms) before account ${index + 1} of ${config.accounts.length}.`);
				await wait(delay);
				output("log", `Wait complete. Starting account ${index + 1} of ${config.accounts.length}.`);
			}
			try {
				successfulAccounts.push(await runAccount(browser, account));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failedAccounts.push(`${account.label}: ${message}`);
				output("error", `[${account.label}] Failed: ${message}`);
			}
		}
	} finally {
		await browser.close();
	}
	if (successfulAccounts.length > 0) {
		output("log", `Batch chip balances:\n${successfulAccounts.map((account) => `- ${account.label}: ${account.chips}`).join("\n")}`);
	}
	if (failedAccounts.length > 0) {
		throw new Error(`${failedAccounts.length} account(s) failed:\n${failedAccounts.join("\n")}`);
	}
}

run().catch((error) => {
	output("error", error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
