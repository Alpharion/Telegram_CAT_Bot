const scraper = require('./scraper');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { Telegraf } = require('telegraf');
const Telegram = require('telegraf/telegram');
const express = require('express');
const app = express();

const telegram = new Telegram(process.env.BOT_TOKEN);
const bot = new Telegraf(process.env.BOT_TOKEN);
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));
app.use(bodyParser.urlencoded({ extended: true }));

var prevCAT = '';
var page;
var browser;
var isLoggedIn = false;

// schedules a webscrape of the cat status webapage every 5 minutes
// if new cat status is different from prev cat status, send a message to channel
// prevCat only updated when a message has been sent
cron.schedule('*/5 * * * *', async () => {
    // Debug
    console.log("Webscrape process starts!")
    // End Debug
    if (!browser) {
        browser = await scraper.startBrowser();
    }

    page = await scraper.startPage(browser);
    console.log("New page for CAT started!")

    await scraper.scrapCAT(process.env.WEB_LOGIN_URL, page, isLoggedIn)
        .then((message) => {
            if (message !== prevCAT && !message.includes('undefined')) {
                telegram
                    .sendMessage(process.env.CHANNEL_ID, message)
                    .then(() => {
                        console.log('cat status was sent');
                        prevCAT = message;
                    }).catch((err) => console.log(err.message));
            };
        })
        .catch((err) => console.log(err));
    isLoggedIn = true;

});

// schedules a websrape of the psi reading webpage every 32nd minute of every hour
// 32m was chosen to give the website enough time to update for the hour as well as to not coincide with the 5 min cat webscrape
cron.schedule('32 */1 * * *', async () => {
    if (!browser) {
        browser = await scraper.startBrowser();
    }

    page = await scraper.startPage(browser);
    console.log("New page for PSI started!")
    await scraper.scrapPSI(process.env.WEB_LOGIN_URL, page, isLoggedIn)
        .then(([message, psi]) => {
            if (process.env.RUN_PSI === 'yes' && psi.some(reading => parseInt(reading) > 100)) {
                telegram
                    .sendMessage(process.env.CHANNEL_ID, message)
                    .then(console.log('psi reading was sent'))
                    .catch((err) => console.log(err.message));
            };
        })
        .catch((err) => console.log(err));
    isLoggedIn = true; // after one time login, set isLoggedIn to true so that scrapCAT does not run the login code again
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Express server listening on port ${port}`));


