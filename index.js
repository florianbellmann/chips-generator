const dotenv = require("dotenv");
const playwright = require("playwright");
const fs = require("fs");

dotenv.config();

(async () => {
  const oldChips = parseInt(fs.readFileSync("chips", "utf8"));
  console.log("Old Chips: ", oldChips);

  console.log("Launching browser and visitting site...");
  const browser = await playwright.chromium.launch();

  const page = await (await browser.newContext()).newPage();
  await page.goto(process.env.website);

  try {
    console.log("accepting cookies");
    await page.locator("#onetrust-accept-btn-handler").click();
  } catch (error) {
    console.log("no popup found");
  }

  console.log("Logging in...");
  await page.waitForLoadState("networkidle");
  console.log("filling user");

  await page.locator("#login").fill(process.env.username);
  console.log("filling password");
  await page.locator("#password").fill(process.env.password);

  await page.waitForTimeout(3000);

  // await page.type("#login", process.env.username);
  // await page.type("#password", process.env.password);
  await page.click("button[type='submit'].btn");
  console.log("submitted");
  try {
    await page.locator(".inApp-close").click();
  } catch (error) {
    console.log("no popup found");
  }
  await delay(4000);

  console.log("Logging done...");
  const chipsDiv = await page.$("#header-user-chips");
  const newChips = (
    await page.evaluate((chipsDiv) => chipsDiv.textContent, chipsDiv)
  )
    .trim()
    .replace(",", "");

  console.log("New Chips: ", newChips);
  fs.writeFileSync("chips", newChips);
  fs.appendFile(
    "run.log",
    `Script run at ${new Date()}. New Chips: ${newChips}.\r\n`,
    function (err) {
      if (err) throw err;
      console.log("Saved!");
    },
  );

  await browser.close();
})();

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
