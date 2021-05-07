import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { getBuildingDataFromCode } from "./building_codes";
import { Entity } from "./entity";
import { MapChunk } from "./map_chunk";
import { GameRoot } from "./root";
import { THEME } from "./theme";
import { drawSpriteClipped } from "../core/draw_utils";

export const CHUNK_OVERLAY_RES = 3;

export class MapChunkView extends MapChunk {
    /**
     *
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     */
    constructor(root, x, y) {
        super(root, x, y);

        /**
         * Whenever something changes, we increase this number - so we know we need to redraw
         */
        this.renderIteration = 0;

        this.markDirty();
    }

    /**
     * Marks this chunk as dirty, rerendering all caches
     */
    markDirty() {
        ++this.renderIteration;
        this.renderKey = this.x + "/" + this.y + "@" + this.renderIteration;
    }

    /**
     * Draws the background layer
     * @param {DrawParameters} parameters
     */
    drawBackgroundLayer(parameters) {
        const systems = this.root.systemMgr.systems;
        systems.mapResources.drawChunk(parameters, this);
        systems.beltUnderlays.drawChunk(parameters, this);
        systems.belt.drawChunk(parameters, this);
    }

    /**
     * Draws the dynamic foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundDynamicLayer(parameters) {
        const systems = this.root.systemMgr.systems;

        systems.itemEjector.drawChunk(parameters, this);
        systems.itemAcceptor.drawChunk(parameters, this);
        systems.miner.drawChunk(parameters, this);
    }

    /**
     * Draws the static foreground layer
     * @param {DrawParameters} parameters
     */
    drawForegroundStaticLayer(parameters) {
        const systems = this.root.systemMgr.systems;

        systems.staticMapEntities.drawChunk(parameters, this);
        systems.lever.drawChunk(parameters, this);
        systems.display.drawChunk(parameters, this);
        systems.storage.drawChunk(parameters, this);
        systems.itemProcessorOverlays.drawChunk(parameters, this);
    }

    /**
     * Overlay
     * @param {DrawParameters} parameters
     */
    drawOverlay(parameters) {
        const overlaySize = globalConfig.mapChunkSize * CHUNK_OVERLAY_RES;
        const sprite = this.root.buffers.getForKey({
            key: "chunk@" + this.root.currentLayer,
            subKey: this.renderKey,
            w: overlaySize,
            h: overlaySize,
            dpi: 1,
            redrawMethod: this.generateOverlayBuffer.bind(this),
        });

        const dims = globalConfig.mapChunkWorldSize;
        const extrude = 0.05;

        // Draw chunk "pixel" art
        parameters.context.imageSmoothingEnabled = false;
        drawSpriteClipped({
            parameters,
            sprite,
            x: this.x * dims - extrude,
            y: this.y * dims - extrude,
            w: dims + 2 * extrude,
            h: dims + 2 * extrude,
            originalW: overlaySize,
            originalH: overlaySize,
        });

        parameters.context.imageSmoothingEnabled = true;
    }

    /**
     *
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} w
     * @param {number} h
     * @param {number} dpi
     */
    generateOverlayBuffer(canvas, context, w, h, dpi) {
        context.fillStyle = THEME.map.chunkOverview.filled;
        // this.containedEntities.length > 0
        //     ? THEME.map.chunkOverview.filled
        //     : THEME.map.chunkOverview.empty;
        context.fillRect(0, 0, w, h);

        if (this.root.app.settings.getAllSettings().displayChunkBorders) {
            context.fillStyle = THEME.map.chunkBorders;
            context.fillRect(0, 0, w, 1);
            context.fillRect(0, 1, 1, h);
        }

        for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
            for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
                const lowerContent = this.lowerLayer[x][y];
                const extra = 1;
                if (!lowerContent) {
                    return;
                }

                context.fillStyle = THEME.map.grid;
                context.fillRect(
                    x * CHUNK_OVERLAY_RES,
                    y * CHUNK_OVERLAY_RES,
                    CHUNK_OVERLAY_RES,
                    CHUNK_OVERLAY_RES
                );

                context.fillStyle = lowerContent.getOverlayColorAsResource();
                context.fillRect(
                    x * CHUNK_OVERLAY_RES + extra,
                    y * CHUNK_OVERLAY_RES + extra,
                    CHUNK_OVERLAY_RES - 2 * extra,
                    CHUNK_OVERLAY_RES - 2 * extra
                );
            }
        }
    }

    /**
     * @param {object} param0
     * @param {CanvasRenderingContext2D} param0.context
     * @param {number} param0.x
     * @param {number} param0.y
     * @param {Entity} param0.entity
     * @param {number} param0.tileSizePixels
     * @param {string=} param0.overrideColor Optionally override the color to be rendered
     */
    static drawSingleWiresOverviewTile({ context, x, y, entity, tileSizePixels, overrideColor = null }) {
        const staticComp = entity.components.StaticMapEntity;
        const data = getBuildingDataFromCode(staticComp.code);
        const metaBuilding = data.metaInstance;
        const overlayMatrix = metaBuilding.getSpecialOverlayRenderMatrix(
            staticComp.rotation,
            data.rotationVariant,
            data.variant,
            entity
        );
        context.fillStyle =
            overrideColor || metaBuilding.getSilhouetteColor(data.variant, data.rotationVariant);
        if (overlayMatrix) {
            for (let dx = 0; dx < 3; ++dx) {
                for (let dy = 0; dy < 3; ++dy) {
                    const isFilled = overlayMatrix[dx + dy * 3];
                    if (isFilled) {
                        context.fillRect(
                            x + (dx * tileSizePixels) / CHUNK_OVERLAY_RES,
                            y + (dy * tileSizePixels) / CHUNK_OVERLAY_RES,
                            tileSizePixels / CHUNK_OVERLAY_RES,
                            tileSizePixels / CHUNK_OVERLAY_RES
                        );
                    }
                }
            }
        } else {
            context.fillRect(x, y, tileSizePixels, tileSizePixels);
        }
    }

    /**
     * Draws the wires layer
     * @param {DrawParameters} parameters
     */
    drawWiresForegroundLayer(parameters) {
        const systems = this.root.systemMgr.systems;
        systems.wire.drawChunk(parameters, this);
        systems.staticMapEntities.drawWiresChunk(parameters, this);
        systems.wiredPins.drawChunk(parameters, this);
    }
}
