import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { GameSystem } from "../game_system";
import { MapChunkView } from "../map_chunk_view";
import { THEME } from "../theme";
import { drawSpriteClipped } from "../../core/draw_utils";
import { FluidItem } from "../items/fluid_item";
import { BaseItem } from "../base_item";

export class MapResourcesSystem extends GameSystem {
    /**
     * Draws the map resources
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        const basicChunkBackground = this.root.buffers.getForKey({
            key: "mapresourcebg",
            subKey: chunk.renderKey,
            w: globalConfig.mapChunkSize,
            h: globalConfig.mapChunkSize,
            dpi: 1,
            redrawMethod: this.generateChunkBackground.bind(this, chunk),
        });

        parameters.context.imageSmoothingEnabled = false;
        drawSpriteClipped({
            parameters,
            sprite: basicChunkBackground,
            x: chunk.tileX * globalConfig.tileSize,
            y: chunk.tileY * globalConfig.tileSize,
            w: globalConfig.mapChunkWorldSize,
            h: globalConfig.mapChunkWorldSize,
            originalW: globalConfig.mapChunkSize,
            originalH: globalConfig.mapChunkSize,
        });
        parameters.context.imageSmoothingEnabled = true;

        parameters.context.globalAlpha = 0.5;

        if (this.root.app.settings.getAllSettings().lowQualityMapResources) {
            // LOW QUALITY: Draw patch items only
            for (let i = 0; i < chunk.patches.length; ++i) {
                const patch = chunk.patches[i];
                const destX = chunk.x * globalConfig.mapChunkWorldSize + patch.pos.x * globalConfig.tileSize;
                const destY = chunk.y * globalConfig.mapChunkWorldSize + patch.pos.y * globalConfig.tileSize;
                const diameter = Math.min(80, 40 / parameters.zoomLevel);

                patch.item.drawItemCenteredClipped(destX, destY, parameters, diameter);
            }
        } else {
            // HIGH QUALITY: Draw all items
            const layer = chunk.lowerLayer;
            const layerEntities = chunk.contents;
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const row = layer[x];
                const rowEntities = layerEntities[x];
                const worldX = (chunk.tileX + x) * globalConfig.tileSize;
                for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                    let lowerItem = row[y];

                    const entity = rowEntities[y];
                    if (entity) {
                        // Don't draw if there is an entity above
                        continue;
                    }

                    if (lowerItem) {
                        if (!(lowerItem instanceof BaseItem)) {
                            lowerItem = lowerItem.item;
                            if (!(lowerItem instanceof BaseItem)) {
                                continue;
                            }
                        }

                        if (lowerItem.getItemType() === "fluid") {
                            let drawnPatches = [];
                            for (let i = 0; i < chunk.patches.length; ++i) {
                                const patch = chunk.patches[i];
                                if (patch.item instanceof FluidItem) {
                                    if (drawnPatches.indexOf(patch) > -1) {
                                        continue;
                                    }

                                    const centerX = Math.round(patch.pos.x);
                                    const centerY = Math.round(patch.pos.y);

                                    const testNeigh = () => {
                                        for (let m = -1; m < 2; m++) {
                                            for (let n = -1; n < 2; n++) {
                                                const posX = centerX + m;
                                                const posY = centerY + n;
                                                if (
                                                    posX >= 0 &&
                                                    posX < globalConfig.mapChunkSize &&
                                                    posY >= 0 &&
                                                    posY < globalConfig.mapChunkSize
                                                ) {
                                                    if (
                                                        !chunk.lowerLayer[posX][posY] ||
                                                        chunk.lowerLayer[posX][posY] != patch.item
                                                    ) {
                                                        return false;
                                                    }
                                                }
                                            }
                                        }
                                        return true;
                                    };

                                    if (!testNeigh()) {
                                        continue;
                                    }

                                    const destX =
                                        chunk.x * globalConfig.mapChunkWorldSize +
                                        patch.pos.x * globalConfig.tileSize;
                                    const destY =
                                        chunk.y * globalConfig.mapChunkWorldSize +
                                        patch.pos.y * globalConfig.tileSize;

                                    const diameter = Math.min(80, 40 / parameters.zoomLevel);

                                    patch.item.drawItemCenteredClipped(destX, destY, parameters, diameter);

                                    drawnPatches.push(patch);
                                }
                            }
                        } else {
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
        if (this.root.app.settings.getAllSettings().disableTileGrid) {
            // The map doesn't draw a background, so we have to
            context.fillStyle = THEME.map.background;
            context.fillRect(0, 0, w, h);
        } else {
            context.clearRect(0, 0, w, h);
        }

        context.globalAlpha = 0.5;
        const layer = chunk.lowerLayer;
        for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
            const row = layer[x];
            for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                const item = row[y];
                if (item) {
                    if (item instanceof BaseItem) {
                        context.fillStyle = item.getBackgroundColorAsResource();
                    } else if (typeof item === "string") {
                        context.fillStyle = item;
                    } else if (typeof item === "object") {
                        context.fillStyle = item.color;
                    }

                    context.fillRect(x, y, 1, 1);
                    context.globalAlpha = 0.5;
                }
            }
        }

        if (this.root.app.settings.getAllSettings().displayChunkBorders) {
            context.fillStyle = THEME.map.chunkBorders;
            context.fillRect(0, 0, w, 1);
            context.fillRect(0, 1, 1, h);
        }
    }
}
