import { globalConfig } from "../core/config";
import { STOP_PROPAGATION } from "../core/signal";
import { Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { BaseItem } from "./base_item";
import { enumMouseButton } from "./camera";
import { Entity } from "./entity";
import { isBombItem, NumberItem } from "./items/number_item";
import { enumDifficulties } from "./map_chunk";
import { MapChunkView } from "./map_chunk_view";
import { GameRoot } from "./root";

export class BaseMap extends BasicSerializableObject {
    static getId() {
        return "Map";
    }

    static getSchema() {
        return {
            seed: types.uint,
            score: types.float,
            difficulty: types.string,
            toggledTileList: types.array(types.vector),
            flaggedTileList: types.array(types.vector),
        };
    }

    /**
     *
     * @param {*} data
     * @param {GameRoot} root
     */
    deserialize(data, root) {
        const errorCode = super.deserialize(data);
        if (errorCode) {
            return errorCode;
        }

        this.score = data.score;
        this.difficulty = data.difficulty;

        /** @type {Array<{x: number, y: number}>} */
        const toggledList = data.toggledTileList;
        /** @type {Array<{x: number, y: number}>} */
        const flaggedList = data.flaggedTileList;

        for (const obj of toggledList) {
            this.toggleList.push(obj);
        }

        while (flaggedList.length > 0) {
            const obj = flaggedList.shift();
            const vector = new Vector(obj.x, obj.y);
            this.handleTileToggle(vector, enumMouseButton.right, false);
        }

        this.handleMarkeds(true);
    }

    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        super();
        this.root = root;

        this.seed = 0;
        this.score = 0;
        this.difficulty = globalConfig.difficulty || enumDifficulties.normal;

        /**
         * Mapping of 'X|Y' to chunk
         * @type {Map<string, MapChunkView>} */
        this.chunksById = new Map();

        /** @type {Array<Vector>} */
        this.toggledTileList = [];

        /** @type {Array<Vector>} */
        this.flaggedTileList = [];

        /** @type {Array<{x: number, y: number}>} */
        this.toggleList = [];

        this.firstShot = true;

        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.camera.upPostHandler.add(this.onMouseUp, this);
        this.root.camera.doubleDownPreHandler.add(this.onMouseDoubleClick, this);
    }

    update() {
        this.handleMarkeds();
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        if (this.root.camera.getIsMapOverlayActive() || button === enumMouseButton.middle) {
            return;
        }

        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        if (this.firstShot && button === enumMouseButton.left) {
            this.handleFirstShot(tile);
            return;
        }

        if (button === enumMouseButton.right) {
            this.handleTileToggle(tile, enumMouseButton.right);
            return;
        }

        this.mouseIsDown = true;
        var hud = this;
        var holdingMouse = false;

        const delay = 100;
        setTimeout(
            function () {
                if (hud.mouseIsDown) {
                    holdingMouse = true;
                }
            }.bind(this.mouseIsDown),
            delay
        );

        setTimeout(function () {
            if (holdingMouse) {
                return;
            }

            hud.handleTileToggle(tile, enumMouseButton.left);
        }, delay);
    }

    onMouseUp() {
        this.mouseIsDown = false;
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDoubleClick(pos, button) {
        if (this.root.camera.getIsMapOverlayActive() || button !== enumMouseButton.left) {
            return;
        }

        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

        if (item.blocked) {
            return;
        }

        this.handleToggleNeighbors(tile);
        return STOP_PROPAGATION;
    }

    /**
     * @param {Vector} tile
     * @param {enumMouseButton} button
     * @param {Boolean} manually
     */
    handleTileToggle(tile, button, manually = true) {
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

        if (button === enumMouseButton.left) {
            if (item.flagged) {
                return;
            }

            this.toggledTileList.push(tile);

            if (!manually) {
                return;
            }

            this.toggleList.push(tile);
        } else if (button === enumMouseButton.right && item.blocked) {
            item.flagged = !item.flagged;

            if (!manually) {
                return;
            }

            for (let i = 0; i < this.flaggedTileList.length; i++) {
                const obj = this.flaggedTileList[i];
                if (obj.x === tile.x && obj.y === tile.y) {
                    this.flaggedTileList.splice(i, 1);
                    return;
                }
            }

            this.flaggedTileList.push(tile);
        }
    }

    /**
     * @param {Vector} tile
     */
    handleToggleNeighbors(tile) {
        for (let x = -1; x < 2; x++) {
            for (let y = -1; y < 2; y++) {
                if (x === 0 && y === 0) {
                    continue;
                }

                const movedVector = tile.addScalars(x, y);
                this.toggledTileList.push(movedVector);
                this.toggleList.push(movedVector);
            }
        }
    }

    /**
     * @param {Boolean} fast
     */
    handleMarkeds(fast = false) {
        /** @type {Array<Object<String, Number>>} */
        const nextToggleList = [];
        while (this.toggleList.length > 0) {
            this.firstShot = false;
            const tile = this.toggleList.shift();

            const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

            if (!item.blocked || item.flagged) {
                continue;
            }

            item.blocked = false;
            this.score += 0.5;

            if (isBombItem(item)) {
                this.score = 0;
                this.root.gameOver = true;
                document.getElementById("scoreboard").innerHTML = `<h2 id="scoreboard">GAME OVER</h2>`;
                continue;
            }

            document.getElementById(
                "scoreboard"
            ).innerHTML = `<h2 id="scoreboard">CURRENT SCORE: ${Math.floor(this.score)} </h2>`;

            if (this.calculateValueOfTile(new Vector(tile.x, tile.y)) === 0) {
                for (let x = -1; x < 2; x++) {
                    for (let y = -1; y < 2; y++) {
                        if (x === 0 && y === 0) {
                            continue;
                        }

                        const newTile = { x: tile.x + x, y: tile.y + y };
                        if (this.toggleList.indexOf(newTile) != -1) {
                            continue;
                        }

                        nextToggleList.push(newTile);
                    }
                }
            }
        }

        this.toggleList = nextToggleList;

        if (fast && this.toggleList.length != 0) {
            this.handleMarkeds(fast);
        }
    }

    /**
     * @param {Vector} pos
     */
    handleFirstShot(pos) {
        const item = this.root.map.getLowerLayerContentXY(pos.x, pos.y);

        if (item.flagged) {
            return;
        }

        this.score += 0.5 * 9;

        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                const tile = new Vector(pos.x + i, pos.y + j);
                const neighbor = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
                if (isBombItem(neighbor)) {
                    neighbor.value = 0;
                }
            }
        }

        this.handleToggleNeighbors(pos);

        document.getElementById("scoreboard").innerHTML = `<h2 id="scoreboard">CURRENT SCORE: ${Math.floor(
            this.score
        )} </h2>`;
    }

    /**
     * @param {Vector} tile
     */
    calculateValueOfTile(tile) {
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
        let endResult = 0;
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                const neighbor = this.root.map.getLowerLayerContentXY(tile.x + i, tile.y + j);
                if (isBombItem(neighbor)) {
                    endResult++;
                }
            }
        }
        if (isBombItem(item)) {
            endResult -= 1;
        }

        item.value = endResult;
        return endResult;
    }

    /**
     * Returns the given chunk by index
     * @param {number} chunkX
     * @param {number} chunkY
     */
    getChunk(chunkX, chunkY, createIfNotExistent = false) {
        const chunkIdentifier = chunkX + "|" + chunkY;
        let storedChunk;

        if ((storedChunk = this.chunksById.get(chunkIdentifier))) {
            return storedChunk;
        }

        if (createIfNotExistent) {
            const instance = new MapChunkView(this.root, chunkX, chunkY);
            this.chunksById.set(chunkIdentifier, instance);
            return instance;
        }

        return null;
    }

    /**
     * Gets or creates a new chunk if not existent for the given tile
     * @param {number} tileX
     * @param {number} tileY
     * @returns {MapChunkView}
     */
    getOrCreateChunkAtTile(tileX, tileY) {
        const chunkX = Math.floor(tileX / globalConfig.mapChunkSize);
        const chunkY = Math.floor(tileY / globalConfig.mapChunkSize);
        return this.getChunk(chunkX, chunkY, true);
    }

    /**
     * Gets a chunk if not existent for the given tile
     * @param {number} tileX
     * @param {number} tileY
     * @returns {MapChunkView?}
     */
    getChunkAtTileOrNull(tileX, tileY) {
        const chunkX = Math.floor(tileX / globalConfig.mapChunkSize);
        const chunkY = Math.floor(tileY / globalConfig.mapChunkSize);
        return this.getChunk(chunkX, chunkY, false);
    }

    /**
     * Checks if a given tile is within the map bounds
     * @param {Vector} tile
     * @returns {boolean}
     */
    isValidTile(tile) {
        if (G_IS_DEV) {
            assert(tile instanceof Vector, "tile is not a vector");
        }
        return Number.isInteger(tile.x) && Number.isInteger(tile.y);
    }

    /**
     * Returns the tile content of a given tile
     * @param {Vector} tile
     * @param {Layer} layer
     * @returns {Entity} Entity or null
     */
    getTileContent(tile, layer) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);
        return chunk && chunk.getLayerContentFromWorldCoords(tile.x, tile.y, layer);
    }

    /**
     * Returns the lower layers content of the given tile
     * @param {number} x
     * @param {number} y
     * @returns {NumberItem=}
     */
    getLowerLayerContentXY(x, y) {
        return this.getOrCreateChunkAtTile(x, y).getLowerLayerFromWorldCoords(x, y);
    }

    /**
     * Returns the tile content of a given tile
     * @param {number} x
     * @param {number} y
     * @param {Layer} layer
     * @returns {Entity} Entity or null
     */
    getLayerContentXY(x, y, layer) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        return chunk && chunk.getLayerContentFromWorldCoords(x, y, layer);
    }

    /**
     * Returns the tile contents of a given tile
     * @param {number} x
     * @param {number} y
     * @returns {Array<Entity>} Entity or null
     */
    getLayersContentsMultipleXY(x, y) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        if (!chunk) {
            return [];
        }
        return chunk.getLayersContentsMultipleFromWorldCoords(x, y);
    }

    /**
     * Checks if the tile is used
     * @param {Vector} tile
     * @param {Layer} layer
     * @returns {boolean}
     */
    isTileUsed(tile, layer) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);
        return chunk && chunk.getLayerContentFromWorldCoords(tile.x, tile.y, layer) != null;
    }

    /**
     * Checks if the tile is used
     * @param {number} x
     * @param {number} y
     * @param {Layer} layer
     * @returns {boolean}
     */
    isTileUsedXY(x, y, layer) {
        const chunk = this.getChunkAtTileOrNull(x, y);
        return chunk && chunk.getLayerContentFromWorldCoords(x, y, layer) != null;
    }

    /**
     * Sets the tiles content
     * @param {Vector} tile
     * @param {Entity} entity
     */
    setTileContent(tile, entity) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }

        this.getOrCreateChunkAtTile(tile.x, tile.y).setLayerContentFromWorldCords(
            tile.x,
            tile.y,
            entity,
            entity.layer
        );

        const staticComponent = entity.components.StaticMapEntity;
        assert(staticComponent, "Can only place static map entities in tiles");
    }

    /**
     * Places an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    placeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        for (let dx = 0; dx < rect.w; ++dx) {
            for (let dy = 0; dy < rect.h; ++dy) {
                const x = rect.x + dx;
                const y = rect.y + dy;
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, entity, entity.layer);
            }
        }
    }

    /**
     * Removes an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    removeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        for (let dx = 0; dx < rect.w; ++dx) {
            for (let dy = 0; dy < rect.h; ++dy) {
                const x = rect.x + dx;
                const y = rect.y + dy;
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, null, entity.layer);
            }
        }
    }

    // Internal

    /**
     * Checks a given tile for validty
     * @param {Vector} tile
     */
    internalCheckTile(tile) {
        assert(tile instanceof Vector, "tile is not a vector: " + tile);
        assert(tile.x % 1 === 0, "Tile X is not a valid integer: " + tile.x);
        assert(tile.y % 1 === 0, "Tile Y is not a valid integer: " + tile.y);
    }
}
