import { globalConfig } from "../core/config";
import { Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { BaseItem } from "./base_item";
import { enumPistonTypes, enumStatusTypes } from "./components/piston";
import { Entity } from "./entity";
import { MapChunkView } from "./map_chunk_view";

export class BaseMap extends BasicSerializableObject {
    static getId() {
        return "Map";
    }

    static getSchema() {
        return {
            seed: types.uint,
        };
    }

    constructor() {
        super();
        this.root = globalConfig.root;

        this.seed = 0;

        /**
         * Mapping of 'X|Y' to chunk
         * @type {Map<string, MapChunkView>} */
        this.chunksById = new Map();
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
            const instance = new MapChunkView(chunkX, chunkY);
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
     * @returns {BaseItem=}
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
            entity.layer,
            entity
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
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, entity.layer, entity);
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
                this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(x, y, entity.layer, null);
            }
        }
    }

    /**
     * Finds which entities to move
     * @param {Entity} entity
     * @param {Vector} movPos
     * @param {Object} moveList
     * @param {Array<Entity>} moveList.list
     * @param {Boolean} moveList.moveable
     */
    findMoveList(entity, movPos, moveList = { list: [], moveable: true }) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        assert(movPos instanceof Vector, "Movement position is not vector");
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        const sticky = entity.components.Sticky;
        const pistonComp = entity.components.Piston;

        if (moveList.list.length == 0) {
            moveList.list.push(entity);
        }

        if (
            pistonComp &&
            (pistonComp.status == enumStatusTypes.on || pistonComp.type == enumPistonTypes.head)
        ) {
            moveList.moveable = false;
            return moveList;
        }

        const updateList = [];
        if (!sticky) {
            for (let dx = 0; dx < rect.w; ++dx) {
                for (let dy = 0; dy < rect.h; ++dy) {
                    const x = rect.x + dx + movPos.x;
                    const y = rect.y + dy + movPos.y;
                    const content = this.getOrCreateChunkAtTile(x, y).getLayerContentFromWorldCoords(
                        x,
                        y,
                        entity.layer
                    );

                    if (!content || content == entity) {
                        continue;
                    }

                    const pistonComp = content.components.Piston;
                    if (
                        pistonComp &&
                        (pistonComp.status == enumStatusTypes.on || pistonComp.type == enumPistonTypes.head)
                    ) {
                        moveList.moveable = false;
                        return moveList;
                    }

                    const metaClass = entity.components.StaticMapEntity.getMetaBuilding();
                    const variant = entity.components.StaticMapEntity.getVariant();
                    if (!metaClass.getIsMoveable(variant)) {
                        moveList.moveable = false;
                        return moveList;
                    }

                    // console.log("something");
                    if (moveList.list.indexOf(content) === -1) {
                        moveList.list.push(content);
                        updateList.push(content);
                    }
                }
            }
        } else {
            for (let i = 0; i < sticky.sides.length; i++) {
                const offPos = sticky.sides[i];

                const x = rect.x + offPos.x;
                const y = rect.y + offPos.y;

                const content = this.getOrCreateChunkAtTile(x, y).getLayerContentFromWorldCoords(
                    x,
                    y,
                    entity.layer
                );

                if (!content || content == entity) {
                    continue;
                }

                const pistonComp = content.components.Piston;
                if (
                    pistonComp &&
                    (pistonComp.status == enumStatusTypes.on || pistonComp.type == enumPistonTypes.head)
                ) {
                    if (offPos.equals(movPos)) {
                        moveList.moveable = false;
                        return moveList;
                    }
                    continue;
                }

                if (moveList.list.indexOf(content) === -1) {
                    moveList.list.push(content);
                    updateList.push(content);
                }
            }
        }

        for (const content of updateList) {
            this.findMoveList(content, movPos, moveList);
        }

        return moveList;
    }

    /**
     * Moves entity with given movemen position
     * @param {Entity} entity
     * @param {Vector} movPos
     */
    moveStaticEntity(entity, movPos) {
        if (!entity) {
            return true;
        }
        assert(entity.components.StaticMapEntity, "Entity is not static");
        assert(movPos instanceof Vector, "Movement position is not vector");
        const moveList = this.findMoveList(entity, movPos);

        if (!moveList.moveable) {
            return false;
        }

        if (movPos.x === 0) {
            moveList.list.sort((a, b) => {
                const aY = a.components.StaticMapEntity.origin.y;
                const bY = b.components.StaticMapEntity.origin.y;

                if (aY > bY) return -movPos.y;
                if (aY < bY) return movPos.y;
                return 0;
            });
        } else {
            moveList.list.sort((a, b) => {
                const aX = a.components.StaticMapEntity.origin.x;
                const bX = b.components.StaticMapEntity.origin.x;

                if (aX > bX) return -movPos.x;
                if (aX < bX) return movPos.x;
                return 0;
            });
        }

        // const updateList = this.layerEntitiesByMovPos(moveList.list, movPos);

        // moveList.list.reverse();

        // console.log(moveList.list.length);

        for (const content of moveList.list) {
            this.removeStaticEntity(content);
            content.components.StaticMapEntity.moveOrigin(movPos);
            this.placeStaticEntity(content);
            this.root.signals.entityChanged.dispatch(content);
        }

        return true;
    }

    // Helpers

    // /**
    //  * Lists entities based on origin via movPos
    //  * @param {Array<Entity>} array
    //  * @param {Vector} movPos
    //  * @returns {Object}
    //  */
    // layerEntitiesByMovPos(array, movPos) {
    //     const layeredArray = {};
    //     // if (movPos.x == 0) {
    //     //     for (let i = 0; i < array.length; i++) {
    //     //         const entity = array[i];
    //     //         const entityY = entity.components.StaticMapEntity.origin.y;
    //     //         if (!layeredArray[entityY]) {
    //     //             layeredArray[entityY] = [];
    //     //         }

    //     //         layeredArray[entityY].push(entity);
    //     //     }
    //     // } else {
    //     //     // for (let i = 0; i < array.length; i++) {
    //     //         const entity = array[i];
    //     //         const entityX = entity.components.StaticMapEntity.origin.x;
    //     //         if (!layeredArray[entityX]) {
    //     //             layeredArray[entityX] = [];
    //     //         }

    //     //     layeredArray[entityX].push(entity);
    //     //     }
    //     // }
    //     return layeredArray;
    // }

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
