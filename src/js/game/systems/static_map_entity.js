import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { GameSystem } from "../game_system";
import { MapChunkView } from "../map_chunk_view";

export class StaticMapEntitySystem extends GameSystem {
    constructor(root) {
        super(root);

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
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;
        for (const content of contents) {
            const staticComp = content.components.StaticMapEntity;
            const sprite = staticComp.getSprite();

            for (const box of staticComp.getMovedTileSpaceBounds()) {
                const rect = box.allScaled(globalConfig.tileSize);
                parameters.context.fillStyle = "blue";
                parameters.context.globalAlpha = 0.2;
                parameters.context.fillRect(rect.x, rect.y, rect.w, rect.h);
                parameters.context.globalAlpha = 1;
            }

            const box = staticComp.getMovedMainHitBox();
            const rect = box.allScaled(globalConfig.tileSize);
            parameters.context.fillStyle = "red";
            parameters.context.globalAlpha = 0.2;
            parameters.context.fillRect(rect.x, rect.y, rect.w, rect.h);
            parameters.context.globalAlpha = 1;

            if (sprite) {
                // Avoid drawing an entity twice which has been drawn for
                // another chunk already
                if (this.drawnUids.has(content.uid)) {
                    continue;
                }

                this.drawnUids.add(content.uid);
                staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
            }
        }
    }

    /**
     * Draws the static wire entities
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawWiresChunk(parameters, chunk) {
        if (G_IS_DEV && globalConfig.debug.doNotRenderStatics) {
            return;
        }

        const drawnUids = new Set();
        const contents = chunk.wireContents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entities = contents[x][y];

                if (!entities) {
                    continue;
                }

                for (const entity of entities) {
                    if (drawnUids.has(entity.uid)) {
                        continue;
                    }
                    drawnUids.add(entity.uid);
                    const staticComp = entity.components.StaticMapEntity;

                    const sprite = staticComp.getSprite();
                    if (sprite) {
                        staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
                    }
                }
            }
        }
    }
}
