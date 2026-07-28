import { chromium } from "playwright-core";
import fs from "fs";

function requiredEnv(name: string) {
	const value = Bun.env[name]?.replaceAll('"', "").replaceAll("'", "").trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

const config = {
	BASE_URL: requiredEnv("BASE_URL"),
	USERNAME: requiredEnv("USERNAME"),
	PASSWORD: requiredEnv("PASSWORD"),
	// CDP endpoint of the shared headless Chromium instance, e.g.
	// http://192.168.178.161:3000. This script does not launch a browser of its
	// own, which is why the dependency is playwright-core (no bundled browser).
	BROWSER_ENDPOINT: requiredEnv("BROWSER_ENDPOINT"),
};

function forceWait(time: number) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

function normalizeChips(chipsText: string) {
	const chips = chipsText.replace(/\D/g, "");
	if (!chips) {
		throw new Error(`Could not parse chips count from text: ${chipsText}`);
	}
	return chips;
}

function updateChips(newChips: string) {
	const oldChips = parseInt(fs.readFileSync("chips", "utf8"));
	console.log(`Updating chips from ${oldChips} to ${newChips}`);

	fs.writeFileSync("chips", newChips.toString());
}

function logRun(newChips: string) {
	fs.appendFile(
		"run.log",
		`Script ran at ${new Date()}. New Chips: ${newChips}.\r\n`,
		function (err) {
			if (err) throw err;
			console.log("Saved!");
		},
	);
}

async function run() {
	console.log(`Connecting to remote browser at ${config.BROWSER_ENDPOINT}`);
	const browser = await chromium.connectOverCDP(config.BROWSER_ENDPOINT);

	// A dedicated context per run, rather than reusing the browser's default
	// one. The remote Chromium is long-lived and shared with other automations,
	// so this keeps the logged-in session out of the shared profile and starts
	// every run from a clean cookie jar.
	const context = await browser.newContext();
	try {
		const page = await context.newPage();

		console.log(`Navigating to ${config.BASE_URL}`);
		await page.goto(config.BASE_URL);

		//try {
		//	console.log("accepting cookies");
		//	await page.locator("#onetrust-accept-btn-handler").click();
		//} catch (error) {
		//	console.log("no popup found");
		//}

		//await page.waitForLoadState("networkidle");

		console.log("filling user", config.USERNAME);
		await page.locator("#login").fill(config.USERNAME);
		//console.log("filling password", config.PASSWORD);
		await page.locator("#password").fill(config.PASSWORD);

		//await page.waitForTimeout(3000);

		await page.getByRole("button", { name: "Log in" }).click();
		console.log("submitted");

		try {
			await page.locator(".inApp-close").click({ timeout: 3000 });
		} catch (error) {
			console.log("no popup found");
		}

		await forceWait(4000);

		const chipsText = await page
			.locator(".header-user-chips")
			.textContent({ timeout: 15000 });
		if (!chipsText) {
			throw new Error(`Could not find chips count after login. Current URL: ${page.url()}`);
		}
		const newChips = normalizeChips(chipsText);

		updateChips(newChips);

		console.log("Automation completed!");

		// Add to log
		logRun(newChips);
	} finally {
		// Close our own context but leave the browser running: it is a shared,
		// long-lived instance owned by the headless-chrome host, and closing it
		// would tear it down for every other consumer. Disconnecting only drops
		// this client's CDP session.
		await context.close();
		await browser.close();
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
