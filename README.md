# shapez.io

<img src="https://i.imgur.com/Y5Z2iqQ.png" alt="shapez.io Logo">

This is the source code for shapez.io, an open source base building game inspired by Factorio.
Your goal is to produce shapes by cutting, rotating, merging and painting parts of shapes.

-   [Trello Board & Roadmap](https://trello.com/b/ISQncpJP/shapezio)
-   [Free web version](https://shapez.io)
-   [itch.io Page](https://tobspr.itch.io/shapezio)
-   [Steam Page](https://steam.shapez.io)
-   [Official Discord](https://discord.com/invite/HN7EVzV) <- _Highly recommended to join!_

## Reporting issues, suggestions, feedback, bugs

1. Ask in `#bugs` / `#feedback` / `#questions` on the [Official Discord](https://discord.com/invite/HN7EVzV) if you are not entirely sure if it's a bug etc.
2. Check out the trello board: https://trello.com/b/ISQncpJP/shapezio
3. See if it's already there - If so, vote for it, done. I will see it. (You have to be signed in on trello)
4. If not, check if it's already reported here: https://github.com/tobspr/shapez.io/issues
5. If not, file a new issue here: https://github.com/tobspr/shapez.io/issues/new
6. I will then have a look (This can take days or weeks) and convert it to trello, and comment with the link. You can then vote there ;)

## Building

-   Make sure `ffmpeg` is on your path
-   Install Node.js and Yarn
-   Install Java (required for textures)
-   Run `yarn` in the root folder
-   Cd into `gulp` folder
-   Run `yarn` and then `yarn gulp` - it should now open in your browser

**Notice**: This will produce a debug build with several debugging flags enabled. If you want to disable them, modify [`src/js/core/config.js`](src/js/core/config.js).

## Build Online with one-click setup

You can use [Gitpod](https://www.gitpod.io/) (an Online Open Source VS Code-like IDE which is free for Open Source) for working on issues and making PRs to this project. With a single click it will start a workspace and automatically:

-   clone the `shapez.io` repo.
-   install all of the dependencies.
-   start `gulp` in `gulp/` directory.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/from-referrer/)

## Helping translate

Please checkout the [Translations readme](translations/).

## Contributing

Since this game is in the more or less early development, I will only accept pull requests which add an immediate benefit. Please understand that low quality PR's might be closed by me with a short comment explaining why.

**If you want to add a new building, please understand that I can not simply add every building to the game!** I recommend to talk to me before implementing anything, to make sure its actually useful. Otherwise there is a high chance of your PR not getting merged.

If you want to add a new feature or in generally contribute I recommend to get in touch with me on Discord:

<a href="https://discord.com/invite/HN7EVzV" target="_blank">
<img src="https://i.imgur.com/SoawBhW.png" alt="discord logo" width="100">
</a>

### Code

The game is based on a custom engine which itself is based on the YORG.io 3 game engine (Actually it shares almost the same core).
The code within the engine is relatively clean with some code for the actual game on top being hacky.

This project is based on ES5. Some ES2015 features are used but most of them are too slow, especially when polyfilled. For example, `Array.prototype.forEach` is only used within non-critical loops since its slower than a plain for loop.

#### Adding a new component

1. Create the component file in `src/js/game/components/<name_lowercase>.js`
2. Create a component class (e.g. `MyFancyComponent`) which `extends Component`
3. Create a `static getId()` method which should return the `PascalCaseName` without component (e.g. `MyFancy`)
4. If any data needs to be persisted, create a `static getSchema()` which should return the properties to be saved (See other components)
5. Add a constructor. **The constructor must be called with optional parameters only!** `new MyFancyComponent({})` should always work.
6. Add any props you need in the constructor.
7. Add the component in `src/js/game/component_registry.js`
8. Add the component in `src/js/game/entity_components.js`
9. Done! You can use your component now

#### Adding a new building

(The easiest way is to copy an existing building)

1. Create your building in `src/js/game/buildings/<my_building.js>`
2. Create the building meta class, e.g. `MetaMyFancyBuilding extends MetaBuilding`
3. Override the methods from MetaBuilding you want to override.
4. Most important is `setupEntityComponents`
5. Add the building to `src/js/game/meta_building_registry.js`: You need to register it on the registry, and also call `registerBuildingVariant`.
6. Add the building to the right toolbar, e.g. `src/js/game/hud/parts/buildings_toolbar.js`:`supportedBuildings`
7. Add a keybinding for the building in `src/js/game/key_action_mapper.js` in `KEYMAPPINGS.buildings`
8. In `translations/base-en.yaml` add it to two sections: `buildings.[my_building].XXX` (See other buildings) and also `keybindings.mappings.[my_building]`. Be sure to do it the same way as other buildings do!
9. Create a icon (128x128, [prefab](https://github.com/tobspr/shapez.io-artwork/blob/master/ui/toolbar-icons.psd)) for your building and save it in `res/ui/buildings_icons` with the id of your building
10. Create a tutorial image (600x600) for your building and save it in `res/ui/building_tutorials`
11. In `src/css/resources.scss` add your building to `$buildings` as well as `$buildingAndVariants`
12. Done! Optional: Add a new reward for unlocking your building at some point.

#### Adding a new game system

1. Create the class in `src/js/game/systems/<system_name>.js`
2. Derive it from `GameSystemWithFilter` if you want it to work on certain entities only which have the given components. Otherwise use `GameSystem` to do more generic stuff.
3. Implement the `update()` method.
4. Add the system in `src/js/game/game_system_manager.js` (To `this.systems` and also call `add` in the `internalInitSystems()` method)
5. If your system should draw stuff, this is a bit more complicated. Have a look at existing systems on how they do it.

#### Checklist for a new building / testing it

This is a quick checklist, if a new building is added this points should be fulfilled:

2. The translation for all variants is done and finalized
3. The artwork (regular sprite) is finalized
4. The blueprint sprite has been generated and is up to date
5. The building has been added to the appropriate toolbar
6. The building has a keybinding which makes sense
7. The building has a reward assigned and is unlocked at a meaningful point
8. The reward for the building has a proper translation
9. The reward for the building has a proper image
10. The building has a proper tutorial image assigned
11. The buliding has a proper toolbar icon
12. The reward requires a proper shape
13. The building has a proper silhouette color
14. The building has a proper matrix for being rendered on the minimap
15. The building has proper statistics in the dialog
16. The building properly contributes to the shapes produced analytics
17. The building is properly persisted in the savegame
18. The building is explained properly, ideally via an interactive tutorial

### Assets

For most assets I use Adobe Photoshop, you can find them <a href="//github.com/tobspr/shapez.io-artwork" target="_blank">here</a>.

All assets will be automatically rebuilt into the atlas once changed (Thanks to dengr1065!)

<img src="https://i.imgur.com/W25Fkl0.png" alt="shapez.io Screenshot">


# About sHape2O

sHape2O, as the name suggests, is a very comprehensive mod expansion for tobspr's shapez.io, adding a vast fluid and pipe mechanic to the gamme that is quite unlike anything in the game so far.

There is a myriad of resources and components yet to come, but the basic premises deals with utilizing a resource type known as <b>water</b>. Water is different from any other resource simply due to its exclusivity to what can be placed on it. There are only 3 buildings in the mod that are allowed to exist on water resource tiles, and nothing in the vanilla game that can exist on the non-wires layer is allowed to be built on water tiles, something that hasn't really been a limitation in the game as of now

### Pipelines
To utilize water resources, you need pumps and pipes. The unique part of this mod is that while there will be pipe and/or pump upgrades (TBD), they will not affect speed much like a belt upgrade will. Pipes utilize a new set of calculations to determine a <b>pressure value</b>, which determines the rate at which water flows through a given set of pipes. Furthermore, a pressure value is not set in stone once determined, as adjustments to the pumps supplying pipelines and addition and subtraction to a diverse set of buildings, mostly painters, can cause the flow rate to go up or down at a moment's notice! Indeed, the amount of water is not determined by mere upgrade tiers and throughput, but it's managing your arsenal of water tanks, pumps, and painter networks to achieve a highly optimized pressure throughout your network.

### How to Apply your Pipe Networks for Maximum Efficiency
Water is very potent resource. Much like wires, it isn't necessary to take full advantage of my modded components to play and "beat" the game, however, again, like wires, if one is able to harness the tools this mod gives them. they can create highly optimized and effcieint factories. Several Default painters have been replaced by water-enhanced variants that gain a +25% (TBD) productivity bonus if the water they receive stays within a given threshold.

Additionally, a new subset of other buildings, such as a Hydropneumatic stacker and Water-Cooled Cutters utilize water resources, with this fixed productivity boost. However, one must utilize their pipes wisely, as they occupy space that would normally be reserved for belts. Additionally, there is negative productivity penalties for failure to supply enough water pressure, as well as overpressurizing, causing your pipes to backup and incurr backlog penalties. however the mod gives you a handful of tools to prevent either of these events from happening.

### Enhanced Late Game Painters
However, the crown jewels upon the sophisticated water pipeline network crown of the mod is a set of <b>brand new</b> painters. Ranging in size and efficiency from the microscopic, space efficient but not very speedy <b>Micropainters</b>, usd to create super compact painting setups at the cost of being half as efficient as their vanilla single and double painters.

there is a few more painters I'll let you discover, but the biggest additions to the mod (literally) have to go to two buildings: The first being the <b>Double-Quad Painter</b>. This mammoth machine takes postive qualities of both DOuble and Quad Painters to mitigate the flaws of both, at the cost of chugging a <i>lot</i> of water.

### SMART Quad Painter and Wires integrations
The second late game painter is something the shapez.io prgrammers will have to look forward to obtaining, as proper pressure management and throughput will be heavily rewarded in shape2O. But I digress... anyway, The SMART Quad. The pinnacle of M.E.Me. technology, the SMART Quad makes itself stand out from it's vanilla bretheren via <b> pure automation</b>. That's right, this painter is heavily dependent on proper wires layer skills, as it cannot function without a valid shape code on the wires layer output. Additionally, while it cannot solve the Quad painter's iefficiency dilemma, the SMART Quad cross-references all shape and dye inputs to the given shape code, and either outright rejects any incorrect shapes, or expells any unused or unnecessary dye resources, which means that this machine has the potential of preventing your MAM on wasting hundreds of incorrect shape and dye patterns in the transition between freeplay levels.

 However, it isn't cut and dry (pun not intended) to utilize such an incredibly, almost overpowered device. The SMART Quad is very strict in terms of pressure thresholds, requiring the most fluid throughput to function and having a <i>very</i> strict threshold in which it will not over or under pressurize. To prevent such failures, sHape2O comes equipped with a wide range of pipeline management buildings, such as Water Tanks, which can store a large quantity of excess water and prevent loss of pressure over distance, a set of splitter-mergers and valves to redirect and merge/distribute to all of your machines, pressure meters to keep a close eye on your pipelines, pressure sinks to expell any unwanted pressure, and much more. Several of the mod's buildings also has mandatory/optional wires layers inputs, to suit your automation needs.

 ### A Huge Thank You

I would like to issue a HUGE thank you to everyone that participated in all stages of this mod's development. Whether you were throwing out ideas and feedback on pre-development documentation, provided me with valuable sprites that make this mod more than just functional buildigns with no textures, were go-to prgrammers when I ran into coding snafus, or simply provided feedback in the multitude of open betas for the mod's public release, you were, are, and will always be treated as equally valauble to the completion of this collossal project. Wihtout you, JusticeForLevel17 (my first modding project), sHape2O (and it's many soon-to-be content updates), and more shapez.io modding projects to come would be simply figments of my overly active imagination!

## Update 1.0 for sHape2O has a scheduled March 2021 release date.