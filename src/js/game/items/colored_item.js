import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { ShapeDefinition } from "../shape_definition";
import { THEME } from "../theme";
import { globalConfig } from "../../core/config";

export class ColoredItem extends BaseItem {
    static getId() {
        return "colored";
    }

    static getSchema() {
        return types.string;
    }

    serialize() {
        return this.color;
    }

    deserialize(data) {
        this.color = data;
    }

    /** @returns {"colored"} **/
    getItemType() {
        return "colored";
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.color === /** @type {ColoredItem} */ (other).color;
    }

    /**
     * @param {string} color
     */
    constructor(color) {
        super();
        this.color = color;

        this.placeable = false;
        this.forceAlpha = 1;
    }

    getBackgroundColorAsResource() {
        return this.color;
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        // context.fillStyle = this.color;
        // context.fillRect(0, 0, globalConfig.tileSize, globalConfig.tileSize);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     */
    drawItemCenteredClipped(x, y, diameter = globalConfig.defaultItemDiameter) {
        const context = globalConfig.parameters.context;
        const temp = context.globalAlpha;
        context.globalAlpha = 1;
        context.fillStyle = this.color;
        context.fillRect(0, 0, globalConfig.tileSize, globalConfig.tileSize);
        context.globalAlpha = temp;
    }
}

/**
 * Singleton instances
 * @type {Object<string, ColoredItem>}
 */
export const COLORED_ITEM_SINGLETONS = {};
