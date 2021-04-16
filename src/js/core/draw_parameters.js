import { globalConfig } from "./config";

/**
 * @typedef {import("../game/root").GameRoot} GameRoot
 * @typedef {import("./rectangle").Rectangle} Rectangle
 */

export class DrawParameters {
    /**
     * @param {object} param0
     * @param {CanvasRenderingContext2D} param0.context
     * @param {Rectangle} param0.visibleRect
     * @param {string} param0.desiredAtlasScale
     * @param {number} param0.zoomLevel
     */
    constructor({ context, visibleRect, desiredAtlasScale, zoomLevel }) {
        this.context = context;
        this.visibleRect = visibleRect;
        this.minimapRect = visibleRect.allScaled(1 / 5);
        this.desiredAtlasScale = desiredAtlasScale;
        this.zoomLevel = zoomLevel;

        /** @type {GameRoot} */
        this.root = globalConfig.root;
    }
}
