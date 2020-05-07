const dotenv = require("dotenv")
const puppeteer = require('puppeteer')
const fs = require("fs")

dotenv.config();

(async () => {

  const oldChips = parseInt(fs.readFileSync("chips", "utf8"))
  console.log("Old Chips: ", oldChips)
  
  console.log("Launching browser and visitting site...")
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(process.env.website)

  console.log("Logging in...")
  await page.type('#login', process.env.username)
  await page.type('#password', process.env.password)
  await page.click('input[type=submit]')

  // await page.waitForNavigation()
  await delay(2000)
  // console.log('New Page URL:', page.url())
  console.log("Logging done...")

  // await page.screenshot({ path: 'screen.png' })

  const chipsDiv = await page.$("#header-user-chips")
  const newChips = (await page.evaluate(chipsDiv => chipsDiv.textContent, chipsDiv)).trim().replace(",", "")
  console.log("New Chips: ", newChips)
  fs.writeFileSync("chips", newChips)

  await browser.close()
})()

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  })
}