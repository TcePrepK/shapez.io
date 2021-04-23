import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { THEME } from "../theme";
import { globalConfig } from "../../core/config";
import { ShapeItem } from "./shape_item";

export class TrashItem extends BaseItem {
    static getId() {
        return "trash";
    }

    static getSchema() {
        return types.string;
    }

    serialize() {
        return this.item.definition;
    }

    deserialize(data) {
        this.item = this.root.shapeDefinitionMgr.getShapeItemFromShortKey(data);
    }

    /** @returns {"trash"} **/
    getItemType() {
        return "trash";
    }

    /**
     * @param {ShapeItem} item
     */
    constructor(item) {
        super();

        this.item = item;
        this.rotation = Math.random() * 360;
        this.offX = (Math.random() - 0.5) * 500;
        this.offY = (Math.random() - 0.5) * 500;

        this.falling = -1000;
    }

    getBackgroundColorAsResource() {
        return THEME.map.resources.shape;
    }

    /**
     * Draws the item to a canvas
     * @param {CanvasRenderingContext2D} context
     * @param {number} size
     */
    drawFullSizeOnCanvas(context, size) {
        this.item.definition.drawFullSizeOnCanvas(context, size);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number=} diameter
     */
    drawItemCenteredImpl(x, y, diameter = globalConfig.defaultItemDiameter) {
        const ctx = globalConfig.parameters.context;
        const alpha = Math.radians(this.rotation);
        ctx.translate(this.offX + x, this.offY + this.falling + y);
        ctx.rotate(alpha);
        this.item.definition.drawCentered(0, 0, diameter);
        ctx.rotate(-alpha);
        ctx.translate(-this.offX - x, -this.offY - this.falling - y);

        if (this.falling < 0) {
            this.falling += 8;
        }
    }
}
