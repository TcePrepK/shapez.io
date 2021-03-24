import { globalConfig } from "../../core/config";
import { GameSystem } from "../game_system";
import { MapChunkView } from "../map_chunk_view";

export class StaticMapEntitySystem extends GameSystem {
    constructor() {
        super();

        /** @type {Set<number>} */
        this.drawnUids = new Set();

        this.root.signals.gameFrameStarted.add(this.clearUidList, this);
    }

    /**
     * Clears the uid list when a new frame started
     */
    clearUidList() {
        this.drawnUids.clear();
    }

    /**
     * Draws the static entities
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];

            const staticComp = entity.components.StaticMapEntity;
            const sprite = staticComp.getSprite();
            if (sprite) {
                // Avoid drawing an entity twice which has been drawn for
                // another chunk already
                if (this.drawnUids.has(entity.uid)) {
                    continue;
                }

                this.drawnUids.add(entity.uid);
                staticComp.drawSpriteOnBoundsClipped(sprite, 2);
            }
        }
    }

    /**
     * Draws the static wire entities
     * @param {MapChunkView} chunk
     */
    drawWiresChunk(chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const drawnUids = new Set();
        const contents = chunk.wireContents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity) {
                    if (drawnUids.has(entity.uid)) {
                        continue;
                    }
                    drawnUids.add(entity.uid);
                    const staticComp = entity.components.StaticMapEntity;

                    const sprite = staticComp.getSprite();
                    if (sprite) {
                        staticComp.drawSpriteOnBoundsClipped(sprite, 2);
                    }
                }
            }
        }
    }
}
