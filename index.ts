import { chromium } from "playwright";
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
	HEADLESS: true,
	USERNAME: requiredEnv("USERNAME"),
	PASSWORD: requiredEnv("PASSWORD"),
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
	const browser = await chromium.launch({ headless: config.HEADLESS });
	try {
		const page = await browser.newPage();

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
		await browser.close();
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
