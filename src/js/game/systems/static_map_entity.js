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
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];

            const staticComp = entity.components.StaticMapEntity;
            const sprite = staticComp.getSprite();

            // Avoid drawing an entity twice which has been drawn for
            // another chunk already
            if (this.drawnUids.has(entity.uid)) {
                continue;
            }

            if (sprite) {
                staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 2);
            }

            this.drawnUids.add(entity.uid);
            // const origin = staticComp.origin.multiplyScalar(globalConfig.tileSize);

            // parameters.context.translate(origin.x, origin.y);
            parameters.context.globalAlpha = 0.2;

            const hitBoxes = staticComp.getTileSpaceBounds();
            parameters.context.fillStyle = "blue";
            for (const hitBox of hitBoxes) {
                const rect = hitBox.allScaled(globalConfig.tileSize);
                parameters.context.fillRect(rect.x, rect.y, rect.w, rect.h);
            }

            parameters.context.globalAlpha = 1;
            // parameters.context.translate(-origin.x, -origin.y);
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
                const entity = contents[x][y];
                if (entity) {
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
