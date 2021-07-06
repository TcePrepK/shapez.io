import { DrawParameters } from "../../core/draw_parameters";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { ShapeDefinition } from "../shape_definition";
import { THEME } from "../theme";
import { globalConfig } from "../../core/config";
import { Vector } from "../../core/vector";

export class ShapeziedColorItem extends BaseItem {
    static getId() {
        return "shapeziedColor";
    }

    static getSchema() {
        return types.string;
    }

    serialize() {
        return this.definition.getHash();
    }

    deserialize(data) {
        this.definition = ShapeDefinition.fromShortKey(data);
    }

    /** @returns {"shapeziedColor"} **/
    getItemType() {
        return "shapeziedColor";
    }

    /**
     * @returns {string}
     */
    getAsCopyableKey() {
        return this.definition.getHash();
    }

    /**
     * @returns {ShapeDefinition}
     */
    getData() {
        return this.definition;
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.definition.getHash() === /** @type {ShapeziedColorItem} */ (other).definition.getHash();
    }

    /**
     * @param {ShapeDefinition} definition
     */
    constructor(definition) {
        super();

        this.definition = definition;
        this.definition.hideCircle = true;

        // this.size = 3;
        // for (let i = 0; i < this.size; i++) {
        //     this.definition[i] = new ShapeDefinition(definition.layers);
        //     this.definition[i].cachedHash = definition.getHash();
        // }
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
        // this.definition.drawFullSizeOnCanvas(context, size);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {DrawParameters} parameters
     * @param {number=} diameter
     */
    drawItemCenteredImpl(x, y, parameters, diameter = globalConfig.defaultItemDiameter) {
        diameter /= 1.5;
        const rot = 120;
        const off = new Vector(0, 3.5);
        parameters.context.translate(x, y);
        for (let i = 360 / rot; i >= 0; i--) {
            const rotOff = off.rotated(Math.radians(rot * i));
            this.definition.drawCentered(rotOff.x, rotOff.y, parameters, diameter);
        }
        parameters.context.translate(-x, -y);
    }
}
