# Darktide Auto Buyer

Darktide Auto Buyer is a short Javascript program which allows to automatically buy weapons from the Darktide shop, based on a configuration file. It heavily relies on darkti.de since the program connects to the website and auto performs click actions on it, like a human would do.

The program run on a local machine under a nodejs server. It uses Puppeteer and Chrome.

### Important notes

Please be aware that I initially made this script for myself and a friend, and decided to make it public. I'm not related to FatSharks and I reserve the right not to maintain the code and not to provide any long-term support.

### Downsides & Limitations
- You need at some point to put your steam credentials in a file
    - That been said, the code is completely public, short and easy to read. With a bit of knowledge you can easily see its only aim is to follow its purpose, and not try to steal your steam account.
- Currently the script doesn't work with Steam 2FA (double authentification), so you need to disable it
    - I haven't found a way to make the script consistenly work with 2FA
- It requires you to install some programs and execute some code, which can be scary
    - But I'll try to make it easy for you
- Currently it is not working with curios
    - Only because the display is currently bugged on darkti.de :P 

### Installation
- Install nodejs : https://nodejs.org/dist/v20.9.0/node-v20.9.0-x64.msi
    - Follow the basic installation, you don't need to add or remove things
- Check installation by opening windows terminal (Windows + R -> cmd) and run :
```sh
npm -v
# This should print something like "10.1.0"
```
> If program is not found, you need to add npm to your PATH and reopen the terminal

- Download the source code and place it in a folder of your choice
    - The code consists of two files : bot.js (main file) and settings.json (configuration file)

- In the windows terminal, navigate to the directory you chose
```sh
cd "mypath"
# For example cd "C:\Program Files\Dartide Auto Buyer"
```
- Run
```sh
npm install puppeteer
# This will create a folder "node_modules" and files "package.json" and "package-lock.json" next to the files you just downloaded
```
- Then run
```sh
npm install fs
```
When launched, the script will check every 10 minutes if a new shop is available. So if you launch it at 10h34, you will get the first shop instantly, and then at 11h04, 12h04 etc ...

The script is ready to be launched, we now need to configure your settings in settings.json.

### Configuration

Configuration is available in settings.json file.
- Make sure darkti.de is working properly for you
- Make sure steam 2FA is disabled, otherwise the script won't work
- At first, set modeDebug to true, and buyWeapons to false (normally already set like this when you download the program)

Now here is the description of each param : 
- steampseudo : your steam pseudo
- steampassword : your steam password
- modeDebug : boolean (true/false) if set to true, you will see the bot in action, otherwise it runs in background (in production, set to false so that you don't have chrome windows popping)
- buyWeapons : whether if you want to automatically buy the weapons that match the criterias or not. Note that if you find more than 5 weapons to buy in ONE shop, the program consider the programmation is wrong and won't buy anything (guardrail). You want to set this to true once you are confident about your programmation
- chromePath : where your chrome.exe application is located
- classes : when you go to darkti.de and select a class, a class token should be visible in the URL. For example : https://darkti.de/armoury/62be598b-73ef-4e35-bdd0-fc7e8427799b/exchange (here the token is "62be598b-73ef-4e35-bdd0-fc7e8427799b"). Fill the token for each class.
- rules (each rule filter is optionnal)
    -   title : title of the weapon (doesn't need to be complete, the script will match even if it is partially given)
    -   type : weapon (currently curio are not supported)
    -   modifierRating : minimum modifier total rating to get selected
    -   modifierDetails : minimum modifier rating to get selected (script will match partial words)
    -   strictModifierCheck : boolean (true/false) : defaults to true. If false, then the modifiers not found do not exclude the weapon (you still need at least one modifier that passes the test to validate the weapon)
    -   rarity : annointed, redeemed, profane
    -   perkNames : perks you WANT to get
    -   perkLevel : minimum perk level
    -   perkNamesBanned : perks you DON'T WANT
    -   blessingNames : blessings you WANT to get
    -   blessingLevel : minimum blessing level
    -   blessingNamesBanned : blessings you DON'T WANT
    -   class : ogryn, psyker, zealot, veteran
    -   buy : boolean (true/false) : whether you want to autobuy any weapon that will match the programmation or not (this setting is overwritten by the global "buyWeapons" setting)

When ready, you can run navigate to your autobuyer directory (using cd like seen previously) and run :
```sh
node bot.js
```

Have fun !