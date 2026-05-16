# TODO

## BUG
- soft candy match bug (see screenshot)
- candy generators bug: become black after first run
- error message "Progress could not be loaded. Default level 1 will be used" after normal login. After login I had still my local storage progress. Progress is not displayed in the leaderboard.
- endless match bug | maybe fixed?
- because of the animation that cells can fall down I get now black boxes inside the recording state.

## Game feel
- add more special behaviour when combining bombs than having just a bigger bomb. Small bomb is to usless and unrewarding - candy crush has no booster as weak as that.
- ich habe für alle farben candy images erstellt. vielleicht nutze die. wenn z.b. ein harter candy zu einem soften wird, dann könnte das image erscheinen und davor ein square sein.
- Wenn man sich mit Google anmeldet, dann frage, ob man den lokalen Stand übernehmen möchte oder den Stand vom Google Account.
- Schütze das System vor Hackern. Z.B. kann man im local storage die `match3-progress` Variable verändern und das wird beim Page reload in die DB übernommen.
- Have a game where the board cells moves or the missing cells Could be a boss or new game mode.
- Have custom levels. Player can do custom levels with the level editor. Save them to the db. You need to be logged in.
- Levels
    - level selector: Maybe show a 3D world with path or an image for each act or something.
    - Level look to similar
    - lvl editor: mobile view
- I can combine multiple patterns at the same time (e.g. square + 4 match) and that will create 2 bombs. Is that wanted?
- maybe make it possible to have a 9x9 field (candy crush uses this board size).
- shop: 
    - you can buy L, T etc. bombs and increase its powerfulness. 
    - Increase coins gained per sugar chest
    - Increase multiplier max
- new cell type
    - Neuer Stein der das Spielfeld verändert (die schwarzen unzerstörbaren Steine)
    - Candies sind in einer Mauer eingeschlossen, welche frei gebombt werden muss.
    - maybe add a candy or implement it on an existing one: it should block the candy flow, so if horizontally only this candy is there, then bellow are no candies and empty fields. Candies can overflow right and left to fill empty spaces. 
- plop match sound is to dominant and gets annoying
- maybe it makes no sense to have a survival time and you should messure the score. If you want to maximize the survival time you would want to wait when the game starts to increase the survival time, because later the time runs down pretty fast and at teh beginning you still have the chance to bring teh time back to teh top.

## UI
- Can I login twice at the same time?

**Optional:**
- friend system
- game over modal: maybe show just a simple recording icon button 
- in debug mode add a pause button with which I can stop the game from doing auto matches.
- recording:
    - maybe show an arrow to indicate what cells switch.
    - show explosion radius
- stats state
- candy world / level selection: add a background image.
- Strenge DSGVO Umsetzung: Google Btn selbst rendern und bei klick das Google script laden und eigenen Btn ersetzen.
- canvas instead of <div>'s for the game board. HUD should stay as DOM elements.
- main menu: err message text should be white
- cutscene: maybe make extra images for mobile phones.
- world map to show levels and where the people are

## Scripts
-

## Publishing
- TWA
- Get 12 testers

## Story
-

## TMP
-