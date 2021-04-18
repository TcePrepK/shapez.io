import { globalConfig } from "../core/config";
import { BaseMap } from "./map";
import { freeCanvas, makeOffscreenBuffer } from "../core/buffer_utils";
import { Entity } from "./entity";
import { THEME } from "./theme";
import { MapChunkView } from "./map_chunk_view";
import { randomInt } from "../core/utils";
import { Rectangle } from "../core/rectangle";
import { Vector } from "../core/vector";

/**
 * This is the view of the map, it extends the map which is the raw model and allows
 * to draw it
 */
export class MapView extends BaseMap {
    constructor() {
        super();

        /**
         * DPI of the background cache images, required in some places
         */
        this.backgroundCacheDPI = 2;

        /**
         * The cached background sprite, containing the flat background
         * @type {HTMLCanvasElement} */
        this.cachedBackgroundCanvas = null;

        /** @type {CanvasRenderingContext2D} */
        this.cachedBackgroundContext = null;
        this.internalInitializeCachedBackgroundCanvases();
        this.root.signals.aboutToDestruct.add(this.cleanup, this);

        this.root.signals.entityAdded.add(this.onEntityChanged, this);
        this.root.signals.entityDestroyed.add(this.onEntityChanged, this);
        this.root.signals.entityChanged.add(this.onEntityChanged, this);

        this.seed = randomInt(0, 100000);

        // this.unlockedChunks = ["-1|-1", "1|1"];
        // this.unlockedChunks = null;
        this.unlockedChunks = ["0|0", "0|1", "1|0", "1|1", "-1|0", "0|-1", "-1|-1"];
        // this.maxChunkLimit = maxChunkLimit;
    }

    cleanup() {
        freeCanvas(this.cachedBackgroundCanvas);
        this.cachedBackgroundCanvas = null;
    }

    /**
     * Called when an entity was added, removed or changed
     * @param {Entity} entity
     */
    onEntityChanged(entity) {
        const staticComp = entity.components.StaticMapEntity;
        if (staticComp) {
            const rect = staticComp.getTileSpaceBounds();
            for (let x = rect.x; x <= rect.right(); ++x) {
                for (let y = rect.y; y <= rect.bottom(); ++y) {
                    this.root.map.getOrCreateChunkAtTile(x, y).markDirty();
                }
            }
        }
    }

    /**
     * Draws all static entities like buildings etc.
     */
    drawStaticEntityDebugOverlays() {
        if (G_IS_DEV && (globalConfig.debug.showAcceptorEjectors || globalConfig.debug.showEntityBounds)) {
            const drawParameters = globalConfig.parameters;
            const cullRange = drawParameters.visibleRect.toTileCullRectangle();
            const top = cullRange.top();
            const right = cullRange.right();
            const bottom = cullRange.bottom();
            const left = cullRange.left();

            const border = 1;

            const minY = top - border;
            const maxY = bottom + border;
            const minX = left - border;
            const maxX = right + border - 1;

            // Render y from top down for proper blending
            for (let y = minY; y <= maxY; ++y) {
                for (let x = minX; x <= maxX; ++x) {
                    // const content = this.tiles[x][y];
                    const chunk = this.getChunkAtTileOrNull(x, y);
                    if (!chunk) {
                        continue;
                    }
                    const content = chunk.getTileContentFromWorldCoords(x, y);
                    if (content) {
                        let isBorder = x <= left - 1 || x >= right + 1 || y <= top - 1 || y >= bottom + 1;
                        if (!isBorder) {
                            content.drawDebugOverlays();
                        }
                    }
                }
            }
        }
    }

    /**
     * Initializes all canvases used for background rendering
     */
    internalInitializeCachedBackgroundCanvases() {
        // Background canvas
        const dims = globalConfig.tileSize;
        const dpi = this.backgroundCacheDPI;
        const [canvas, context] = makeOffscreenBuffer(dims * dpi, dims * dpi, {
            smooth: false,
            label: "map-cached-bg",
        });
        context.scale(dpi, dpi);

        context.fillStyle = THEME.map.background;
        context.fillRect(0, 0, dims, dims);

        const borderWidth = THEME.map.gridLineWidth;
        context.fillStyle = THEME.map.grid;
        context.fillRect(0, 0, dims, borderWidth);
        context.fillRect(0, borderWidth, borderWidth, dims);

        context.fillRect(dims - borderWidth, borderWidth, borderWidth, dims - 2 * borderWidth);
        context.fillRect(borderWidth, dims - borderWidth, dims, borderWidth);

        this.cachedBackgroundCanvas = canvas;
        this.cachedBackgroundContext = context;
    }

    /**
     * Draws the maps foreground
     */
    drawForeground() {
        this.drawVisibleChunks(MapChunkView.prototype.drawForegroundDynamicLayer, true);
        this.drawVisibleChunks(MapChunkView.prototype.drawForegroundStaticLayer, true);
    }

    /**
     * Calls a given method on all given chunks
     * @param {function} method
     * @param {boolean} limited
     */
    drawVisibleChunks(method, limited = null) {
        const parameters = globalConfig.parameters;
        const cullRange = parameters.visibleRect.allScaled(1 / globalConfig.tileSize);
        const top = cullRange.top();
        const right = cullRange.right();
        const bottom = cullRange.bottom();
        const left = cullRange.left();

        const border = 0;
        const minY = top - border;
        const maxY = bottom + border;
        const minX = left - border;
        const maxX = right + border;

        const chunkStartX = Math.floor(minX / globalConfig.mapChunkSize);
        const chunkStartY = Math.floor(minY / globalConfig.mapChunkSize);

        const chunkEndX = Math.floor(maxX / globalConfig.mapChunkSize);
        const chunkEndY = Math.floor(maxY / globalConfig.mapChunkSize);

        // Render y from top down for proper blending
        for (let chunkX = chunkStartX; chunkX <= chunkEndX; ++chunkX) {
            for (let chunkY = chunkStartY; chunkY <= chunkEndY; ++chunkY) {
                const chunkID = chunkX + "|" + chunkY;
                // console.log(limited);
                if (limited == true && this.unlockedChunks && !this.unlockedChunks.includes(chunkID)) {
                    continue;
                }

                if (limited == false && (!this.unlockedChunks || this.unlockedChunks.includes(chunkID))) {
                    continue;
                }

                // if (new Vector(chunkX, chunkY).length() > this.limit) {
                //     continue;
                // }

                const chunk = this.root.map.getChunk(chunkX, chunkY, true);
                method.call(chunk);
            }
        }
    }

    /**
     * Draws the wires foreground
     */
    drawWiresForegroundLayer() {
        this.drawVisibleChunks(MapChunkView.prototype.drawWiresForegroundLayer, true);
    }

    /**
     * Draws the map overlay
     */
    drawOverlay() {
        this.drawVisibleChunks(MapChunkView.prototype.drawOverlay, true);
    }

    /**
     * Draws the map background
     */
    drawBackground() {
        this.drawVisibleChunks(MapChunkView.prototype.drawUnlockedChunks, true);
        this.drawVisibleChunks(MapChunkView.prototype.drawLockedChunks, false);
        this.drawVisibleChunks(MapChunkView.prototype.drawBackgroundLayer, true);
    }
}
