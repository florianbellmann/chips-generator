import { chromium } from "playwright";
import fs from "fs";

const config = {
	BASE_URL: Bun.env.BASE_URL!,
	HEADLESS: false,
	USERNAME: Bun.env.USERNAME!,
	PASSWORD: Bun.env.PASSWORD!,
};

function forceWait(time: number) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
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
	const page = await browser.newPage();

	console.log(`Navigating to ${config.BASE_URL}`);
	await page.goto(config.BASE_URL);

	try {
		console.log("accepting cookies");
		await page.locator("#onetrust-accept-btn-handler").click();
	} catch (error) {
		console.log("no popup found");
	}

	await page.waitForLoadState("networkidle");

	console.log("filling user", config.USERNAME);
	await page.locator("#login").fill(config.USERNAME);
	console.log("filling password");
	await page.locator("#password").fill(config.PASSWORD);

	//await page.waitForTimeout(3000);

	await page.click("button[type='submit'].btn");
	console.log("submitted");

	try {
		await page.locator(".inApp-close").click();
	} catch (error) {
		console.log("no popup found");
	}

	await forceWait(4000);

	const chipsDiv = await page.$("#header-user-chips");
	const newChips = (await page.evaluate(
		(chipsDiv) => chipsDiv!.textContent,
		chipsDiv,
	)!)!
		.trim()
		.replace(",", "");

	updateChips(newChips.trim().replace(",", ""));

	await browser.close();
	console.log("Automation completed!");

	// Add to log
	logRun(newChips);
}

run().catch(console.error);
