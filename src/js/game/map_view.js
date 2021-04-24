import { globalConfig } from "../core/config";
import { BaseMap } from "./map";
import { freeCanvas, makeOffscreenBuffer } from "../core/buffer_utils";
import { Entity } from "./entity";
import { THEME } from "./theme";
import { MapChunkView } from "./map_chunk_view";

/**
 * This is the view of the map, it extends the map which is the raw model and allows
 * to draw it
 */
export class MapView extends BaseMap {
    constructor(trashMap = false) {
        super(trashMap);

        this.trashMap = trashMap;

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
        this.drawVisibleChunks(MapChunkView.prototype.drawForegroundDynamicLayer);
        this.drawVisibleChunks(MapChunkView.prototype.drawForegroundStaticLayer);
    }

    /**
     * Draws the maps foreground
     */
    drawTrashMap() {
        this.drawVisibleChunks(MapChunkView.prototype.drawTrashLayer);
    }

    /**
     * Calls a given method on all given chunks
     * @param {function} method
     */
    drawVisibleChunks(method) {
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
                const chunk = this.root.map.getChunk(chunkX, chunkY, true);
                method.call(chunk);
            }
        }
    }

    /**
     * Draws the wires foreground
     */
    drawWiresForegroundLayer() {
        this.drawVisibleChunks(MapChunkView.prototype.drawWiresForegroundLayer);
    }

    /**
     * Draws the map overlay
     */
    drawOverlay(parameters) {
        this.drawVisibleChunks(MapChunkView.prototype.drawOverlay);
    }

    /**
     * Draws the map background
     */
    drawBackground() {
        const parameters = globalConfig.parameters;
        // Render tile grid
        if (!this.root.app.settings.getAllSettings().disableTileGrid) {
            const dpi = this.backgroundCacheDPI;
            parameters.context.scale(1 / dpi, 1 / dpi);

            parameters.context.fillStyle = parameters.context.createPattern(
                this.cachedBackgroundCanvas,
                "repeat"
            );
            parameters.context.fillRect(
                parameters.visibleRect.x * dpi,
                parameters.visibleRect.y * dpi,
                parameters.visibleRect.w * dpi,
                parameters.visibleRect.h * dpi
            );
            parameters.context.scale(dpi, dpi);
        }

        if (this.root.map.trashMap) {
            return;
        }

        this.drawVisibleChunks(MapChunkView.prototype.drawBackgroundLayer);
    }
}
