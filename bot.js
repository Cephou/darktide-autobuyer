// npm install nodemailer
// npm install puppeteer
// npm install fs

// "title": "Grenadier Gauntlet",
// "type": "weapon", (or curio)
// "modifierRating": "360",
// "modifierDetails": { "Damage": 75, "Ammo": 75 }
// "strictModifierCheck": true/false : defaults to true. If false, then the modifiers not found do not exclude the weapon (you still need at least one modifier that passes the test to validate the weapon)
// "rarity": "annointed",
// "perkNames": ["Ranged Critical Hit Damage", "Ranged Weak Spot Damage"],
// "perkLevel": 3,
// "perkNamesBanned": [""],
// "blessingNames": ["Dumdum", "Headhunter"],
// "blessingLevel": 3,
// "blessingNamesBanned": ["Decimator", "All or Nothing", "Vicious Slice"],
// "class": "ogryn",
// "buy": true/false,

// --------------------------------

const puppeteer = require('puppeteer')
const fs = require('fs');
const fsP = require('fs').promises;
try {
  let nodemailer = require("nodemailer");
} catch (e) {
  let nodemailer = false;
}

let settings = {};
let canClose = false;

var hoursVerified = [];

async function loadSettings() {
  const settingsRaw = await fsP.readFile('settings.json', "utf8");
  settings = JSON.parse(settingsRaw);
  if(settings.buyWeapons) {
    console.log("----- BUY IS ENABLED -----");
  } else {
    console.log("----- BUY IS DISABLED ------");
  }
}

async function main() {
  await loadSettings();
  const [browser, page] = await openBrowser();
  try {
    await reachShop(page);
    await shopToJSON(page);
    await sleep(1000);
    await checkRules(page);
    let currentHour = getCurrentHour();
    hoursVerified.push(currentHour);
    console.log(currentHour);
    var interval = setInterval(async function() {
      if(canClose) {
        canClose = false;
        await browser.close();
        clearInterval(interval);
      }
    }, 1000);
  } catch (error) {
    if(settings.modeDebug) console.log(error);
    console.log("Error (no internet ?)");
  }
}

async function shopToJSON(page) {
  var weaponClasses = {};
  for (let classIndex in settings.classes) {
    classUUID = settings.classes[classIndex];
    className = classIndex;
    await page.goto('https://darkti.de/armoury/'+classUUID+'/exchange');
    await sleep(700);
    await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'});
    let pageWeapons = await page.evaluate(() => {
      $.fn.ignore = function(sel) {
        return this.clone().find(sel || ">*").remove().end();
      };
      var weapons = [];
      const colors = {
        "text-foreground/60": "profane",
        "text-green-800": "redeemed",
        "text-blue-800": "annointed",
      }
      const rarity = {
        "Ⅰ": 1,
        "Ⅱ": 2,
        "Ⅲ": 3,
        "Ⅳ": 4,
      }
      let $containers = $(".bg-card");
      $containers.each(function() {
        var weapon = {
          "title": $(this).find(".isolate:first").find(".font-bold:nth-child(2)").text(),
        };
        var modifierRating = 0;
        var modifierDetails = {};
        $(this).find(".stat").each(function() {
          rating = parseInt($(this).find(".leading-none").text().replace("%", ""));
          modifierDetails[$(this).find(".font-heading:first").text()] = rating;
          modifierRating += rating;
        });
        weapon["modifierRating"] = modifierRating;
        weapon["type"] = (weapon["modifierRating"] == 0) ? "curio" : "weapon";
        if(weapon["type"] == "curio") return;
        if(weapon["type"] != "curio") {
          weapon["modifierDetails"] = modifierDetails;
        }
        weapon["rarity"] = colors[$(this).find(".isolate:first").find(".font-bold:nth-child(2)").attr("class").replace("font-bold ", "")];
        weapon["perks"] = [];
        weapon["blessings"] = [];
        if(weapon["rarity"] == "redeemed" || weapon["rarity"] == "annointed") {
          var perkDiv = $(this).find("div:contains('Perks')").closest("div");
          var text = perkDiv.find(".flex.items-center").contents().filter(function() {
            return this.nodeType === 3;
          }).text().trim().slice(6);
          weapon["perks"].push({
            "name": text,
            "level": rarity[perkDiv.find(".mr-2:first").text()],
          });
        }
        if(weapon["rarity"] == "annointed") {
          var blessingDiv = $(this).find("div:contains('Blessings')").closest("div");
          var regex = /Tier (\d+)/;
          var level = blessingDiv.find("img").attr("title").match(regex)[1]
          weapon["blessings"].push({
            "name": blessingDiv.find(".flex.flex-col div:nth-child(1)").text() + ": " + blessingDiv.find(".flex.flex-col div:nth-child(2)").text(),
            "level": level,
          });
        }
        weapon["value"] = $(this).find("[name='buy-item']").attr("value");
        weapons.push(weapon);
      });
      return weapons;
    });
    pageWeapons.forEach(obj => obj.class = className);
    weaponClasses[className] = pageWeapons;
  }
  
  var weaponsString = JSON.stringify(weaponClasses, null, "\t").toString();
  fs.writeFile('weapons.json', weaponsString, err => {
    if (err) {
      console.error(err);
    }
  });
}

async function buyWeapons(page, weapons) {
  let countBuy = 0;
  for (const weapon of weapons) {
    if (weapon.buy === true) {
      countBuy++;
    }
  }
  if(countBuy > 0) console.log("----- BUYING " + countBuy + " WEAPON(S) -----");
  if(countBuy < 5) { // guardrail
    for(weaponIndex in weapons) {
      var weapon = weapons[weaponIndex];
      if(weapon["buy"] === true) {
        classUUID = settings.classes[weapon["class"]];
        await page.goto('https://darkti.de/armoury/'+classUUID+'/exchange');
        await sleep(2000);
        await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.2.1.min.js'});
        await page.evaluate((weapon) => {
          $("[name='buy-item'][value='"+weapon["value"]+"']").click();
        }, weapon);
        await sleep(2000);
      }
    }
  }
  canClose = true;
}

async function checkRules(page) {
  fs.readFile('weapons.json', "utf8", async function read(err, data) {
    if (err) {
      throw err;
    }
    var toSend = [];
    const classWeapons = JSON.parse(data);
    for (let className in classWeapons) {
      for (let weaponKey in classWeapons[className]) {
        var weapon = classWeapons[className][weaponKey];
        for(let ruleKey in settings.rules) {
          let rule = settings.rules[ruleKey];
          if(rule["class"] && rule["class"] != className) {
            continue;
          }
          if(rule["type"] && rule["type"] != weapon["type"]) {
            continue;
          }
          if(rule["title"] && !(weapon["title"].includes(rule["title"]))) {
            continue;
          }
          if(rule["modifierRating"] && (parseInt(weapon["modifierRating"]) < parseInt(rule["modifierRating"]))) {
            continue;
          }
          if(rule["modifierDetails"]) {
            var modifierMeetsCriterias = true;
            var modifierFound = false;
            for(let modifierName in rule["modifierDetails"]) {
              var modifierValue = rule["modifierDetails"][modifierName];
              if(weapon["modifierDetails"] && weapon["modifierDetails"][modifierName]) {
                var modifierFound = true;
                if((parseInt(weapon["modifierDetails"][modifierName]) < parseInt(modifierValue))) {
                  modifierMeetsCriterias = false;
                  break;
                }
              } else {
                if(!(rule["strictModifierCheck"] === false)) {
                  modifierMeetsCriterias = false;
                }
              }
            }
            if(!modifierFound) continue;
            if(!modifierMeetsCriterias) continue;
          }
          if(rule["rarity"] && (weapon["rarity"] != rule["rarity"])) {
            continue;
          }
          if(rule["perkLevel"] && ((weapon["perks"][0]?.level ?? 0) < parseInt(rule["perkLevel"]))) {
            continue;
          }
          if(rule["perkNames"]) {
            var perkFound = false;
            for(let perkKey in rule["perkNames"]) {
              var perkName = rule["perkNames"][perkKey];
              if((weapon["perks"][0]?.name ?? "").includes(perkName)) {
                perkFound = true;
                break;
              }
            }
            if(!perkFound) continue;
          }
          if(rule["perkNamesBanned"]) {
            var perkBannedFound = false;
            for(let perkBannedKey in rule["perkNamesBanned"]) {
              var perkBannedName = rule["perkNamesBanned"][perkBannedKey];
              if((weapon["perks"][0]?.name ?? "").includes(perkBannedName)) {
                perkBannedFound = true;
                break;
              }
            }
            if(perkBannedFound) continue;
          }
          if(rule["blessingLevel"] && ((weapon["blessings"][0]?.level ?? 0) < parseInt(rule["blessingLevel"]))) {
            continue;
          }
          if(rule["blessingNames"]) {
            var blessingFound = false;
            for(let blessingKey in rule["blessingNames"]) {
              var blessingName = rule["blessingNames"][blessingKey];
              if((weapon["blessings"][0]?.name ?? "").includes(blessingName)) {
                blessingFound = true;
                break;
              }
            }
            if(!blessingFound) continue;
          }
          if(rule["blessingNamesBanned"]) {
            var blessingBannedFound = false;
            for(let blessingBannedKey in rule["blessingNamesBanned"]) {
              var blessingBannedName = rule["blessingNamesBanned"][blessingBannedKey];
              if((weapon["blessings"][0]?.name ?? "").includes(blessingBannedName)) {
                blessingBannedFound = true;
                break;
              }
            }
            if(blessingBannedFound) continue;
          }
          let weaponCopy = {...weapon};
          if(rule["buy"] === true) {
            weaponCopy["buy"] = true;
          } else {
            weaponCopy["buy"] = false;
          }
          // This item is good !
          toSend.push(weaponCopy);
          console.log(weaponCopy);
        }
      }
    }
    if(toSend.length > 0) {
      if(settings.buyWeapons === true) await buyWeapons(page, toSend);
      sendMail(toSend);
    }
  });
}

async function reachShop(page) {
  await page.goto('https://darkti.de/auth/steam');
  await page.waitForSelector('.newlogindialog_TextInput_2eKVn');
  await page.type('.newlogindialog_TextInput_2eKVn', settings.steampseudo);
  await page.type('[type="password"]', settings.steampassword);
  await page.click(".newlogindialog_SubmitButton_2QgFE");
  await page.waitForSelector('#imageLogin');
  await page.click("#imageLogin");
  await page.waitForSelector('.h-screen');
  await sleep(1000);
}

async function openBrowser() {
  const args = [
    '--enable-automation',
  ];
  const options = {
    args,
    headless: (settings.modeDebug ? false : "new"),
    ignoreHTTPSErrors: true,
    defaultViewport: null,
    executablePath: settings.chromePath,
  };
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();
  return [browser, page];
}

function getCurrentHour() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = ("0" + (currentDate.getMonth() + 1)).slice(-2);
  const day = ("0" + currentDate.getDate()).slice(-2);
  const hour = ("0" + currentDate.getHours()).slice(-2);
  const formattedDate = year + "-" + month + "-" + day + "-" + hour;
  return formattedDate;
}

async function sendMail(weapon) {
  if(settings.pauseMail || nodemailer === false) return;
  let transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: settings.email,
      pass: settings.gmailpass,
    }
  });
  let mailOptions = {
    from: settings.email,
    to: settings.email,
    subject: "Darktide Shop Notification",
    text: JSON.stringify(weapon, null, "\t"),
  };
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Mail sent: " + info.response);
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
 
// We check once and then every 10 minutes
main();
setInterval(function() {
  let currentHour = getCurrentHour();
  if(!hoursVerified.includes(currentHour)) {
    main();
  }
}, 1000 * 60 * 10);