import { globalConfig } from "../core/config";
import { Rectangle } from "../core/rectangle";
import { Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { BaseItem } from "./base_item";
import { Entity } from "./entity";
import { MapChunkView } from "./map_chunk_view";
import { GameRoot } from "./root";

export class BaseMap extends BasicSerializableObject {
    static getId() {
        return "Map";
    }

    static getSchema() {
        return {
            seed: types.uint,
        };
    }

    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        super();
        this.root = root;

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
        tileX = Math.floor(tileX);
        tileY = Math.floor(tileY);
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
        tileX = Math.floor(tileX);
        tileY = Math.floor(tileY);
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
     * @returns {Array<Entity>} Entities or null
     */
    getTileContent(tile, layer) {
        if (G_IS_DEV) {
            this.internalCheckTile(tile);
        }
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);
        return chunk && chunk.getLayerContentsFromWorldCoords(tile.x, tile.y, layer);
    }

    /**
     * Returns the exact tile content of a given tile
     * @param {Vector} tile
     * @param {Layer} layer
     * @returns {Entity} Entity or null
     */
    getExactTileContent(tile, layer) {
        const chunk = this.getChunkAtTileOrNull(tile.x, tile.y);

        if (!chunk) {
            return;
        }

        const contents = chunk.getLayerContentsFromWorldCoords(tile.x, tile.y, layer);

        if (!contents) {
            return;
        }

        for (const content of contents) {
            const staticComp = content.components.StaticMapEntity;
            if (!staticComp.containsPoint(tile.x, tile.y)) {
                continue;
            }

            return content;
        }
    }

    /**
     * Returns the lower layers content of the given tile
     * @param {number} x
     * @param {number} y
     * @returns {BaseItem=}
     */
    getLowerLayerContentXY(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        return this.getOrCreateChunkAtTile(x, y).getLowerLayerFromWorldCoords(x, y);
    }

    /**
     * Returns the tile content of a given tile
     * @param {number} x
     * @param {number} y
     * @param {Layer} layer
     * @returns {Array<Entity>} Entities or null
     */
    getLayerContentXY(x, y, layer) {
        x = Math.floor(x);
        y = Math.floor(y);
        const chunk = this.getChunkAtTileOrNull(x, y);
        return chunk && chunk.getLayerContentsFromWorldCoords(x, y, layer);
    }

    /**
     * Returns the tile contents of a given tile
     * @param {number} x
     * @param {number} y
     * @returns {Array<Entity>} Entity or null
     */
    getLayersContentsMultipleXY(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
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
        return chunk && chunk.getLayerContentsFromWorldCoords(tile.x, tile.y, layer) != null;
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
        return chunk && chunk.getLayerContentsFromWorldCoords(x, y, layer) != null;
    }

    // /**
    //  * Sets the tiles content
    //  * @param {Vector} tile
    //  * @param {Entity} entity
    //  */
    // setTileContent(tile, entity) {
    //     if (G_IS_DEV) {
    //         this.internalCheckTile(tile);
    //     }

    //     this.getOrCreateChunkAtTile(tile.x, tile.y).setLayerContentFromWorldCords(
    //         tile.x,
    //         tile.y,
    //         entity.layer,
    //         entity
    //     );

    //     const staticComponent = entity.components.StaticMapEntity;
    //     assert(staticComponent, "Can only place static map entities in tiles");
    // }

    /**
     * Places an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    placeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const hitBoxes = staticComp.getMovedTileSpaceBounds();
        for (const rect of hitBoxes) {
            for (let dx = 0; dx < rect.w + 1; ++dx) {
                for (let dy = 0; dy < rect.h + 1; ++dy) {
                    const x = Math.floor(rect.x) + dx;
                    const y = Math.floor(rect.y) + dy;
                    const tile = new Rectangle(x, y, 1, 1);
                    if (!rect.getIntersection(tile)) {
                        continue;
                    }

                    this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(
                        x,
                        y,
                        entity.layer,
                        entity
                    );
                }
            }

            // for (let dx = 0; dx < rect.w; ++dx) {
            //     for (let dy = 0; dy < rect.h; ++dy) {
            //         const x = rect.x + dx;
            //         const y = rect.y + dy;
            //         this.getOrCreateChunkAtTile(x, y).setLayerContentFromWorldCords(
            //             x,
            //             y,
            //             entity.layer,
            //             entity
            //         );
            //     }
            // }
        }
    }

    /**
     * Removes an entity with the StaticMapEntity component
     * @param {Entity} entity
     */
    removeStaticEntity(entity) {
        assert(entity.components.StaticMapEntity, "Entity is not static");
        const staticComp = entity.components.StaticMapEntity;
        const hitBoxes = staticComp.getMovedTileSpaceBounds();
        for (const rect of hitBoxes) {
            for (let dx = 0; dx < rect.w + 1; ++dx) {
                for (let dy = 0; dy < rect.h + 1; ++dy) {
                    const x = Math.floor(rect.x) + dx;
                    const y = Math.floor(rect.y) + dy;
                    const tile = new Rectangle(x, y, 1, 1);
                    if (!rect.getIntersection(tile)) {
                        continue;
                    }

                    this.getOrCreateChunkAtTile(x, y).removeLayerContentFromWorldCords(
                        x,
                        y,
                        entity.layer,
                        entity
                    );
                }
            }

            // for (let dx = 0; dx < rect.w; ++dx) {
            //     for (let dy = 0; dy < rect.h; ++dy) {
            //         const x = rect.x + dx;
            //         const y = rect.y + dy;
            //         this.getOrCreateChunkAtTile(x, y).removeLayerContentFromWorldCords(x, y, entity.layer);
            //     }
            // }
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
