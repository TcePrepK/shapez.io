import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { GameSystem } from "../game_system";
import { MapChunkView } from "../map_chunk_view";
import { drawSpriteClipped } from "../../core/draw_utils";
import { makeOffscreenBuffer } from "../../core/buffer_utils";

export class MapResourcesSystem extends GameSystem {
    constructor(root) {
        super(root);

        const [canvas, context] = makeOffscreenBuffer(globalConfig.mapChunkSize, globalConfig.mapChunkSize, {
            label: "buffer-mapresourcebg",
            smooth: true,
        });

        this.backgroundCanvas = canvas;
        this.backgroundContext = context;
    }

    /**
     * Draws the map resources
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        this.generateChunkBackground(
            chunk,
            this.backgroundCanvas,
            this.backgroundContext,
            globalConfig.mapChunkSize,
            globalConfig.mapChunkSize,
            null
        );

        parameters.context.imageSmoothingEnabled = false;
        drawSpriteClipped({
            parameters,
            sprite: this.backgroundCanvas,
            x: chunk.tileX * globalConfig.tileSize,
            y: chunk.tileY * globalConfig.tileSize,
            w: globalConfig.mapChunkWorldSize,
            h: globalConfig.mapChunkWorldSize,
            originalW: globalConfig.mapChunkSize,
            originalH: globalConfig.mapChunkSize,
        });
        parameters.context.imageSmoothingEnabled = true;

        parameters.context.globalAlpha = 0.5;

        // HIGH QUALITY: Draw all items
        const layer = chunk.lowerLayer;
        for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
            const row = layer[x];
            const worldX = (chunk.tileX + x) * globalConfig.tileSize;
            for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                const lowerItem = row[y];
                if (lowerItem) {
                    const worldY = (chunk.tileY + y) * globalConfig.tileSize;

                    const destX = worldX + globalConfig.halfTileSize;
                    const destY = worldY + globalConfig.halfTileSize;

                    lowerItem.drawItemCenteredClipped(
                        destX,
                        destY,
                        parameters,
                        globalConfig.defaultItemDiameter
                    );
                }
            }
        }

        parameters.context.globalAlpha = 1;
    }

    /**
     *
     * @param {MapChunkView} chunk
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number} dpi
     */
    generateChunkBackground(chunk, canvas, context, w, h, dpi) {
        context.clearRect(0, 0, w, h);

        context.globalAlpha = 0.5;
        const layer = chunk.lowerLayer;
        for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
            const row = layer[x];
            for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                const item = row[y];
                if (item) {
                    context.fillStyle = item.getBackgroundColorAsResource();
                    context.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}
