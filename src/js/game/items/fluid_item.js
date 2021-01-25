import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Loader } from "../../core/loader";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { THEME } from "../theme";

export const enumFluids = {
    water: "water",
    //oil: "oil",
};

export const enumFluidsToHex = {
    water: "#5ba0fb",
    //oil: "#373A36",
};

export class FluidItem extends BaseItem {
    static getId() {
        return "fluid";
    }

    constructor(fluid) {
        super();
        this.fluid = fluid;
    }

    static getSchema() {
        return types.enum(enumFluids);
    }

    serialize() {
        return this.fluid;
    }

    deserialize(data) {
        this.fluid = data;
    }

    /** @returns {"fluid"} **/
    getItemType() {
        return "fluid";
    }

    getAsCopyableKey() {
        return this.fluid;
    }

    /**
     * @param {BaseItem} other
     */
    equalsImpl(other) {
        return this.fluid === /** @type {FluidItem} */ (other).fluid;
    }

    getBackgroundColorAsResource() {
        return enumFluidsToHex[this.fluid];
    }

    // /**
    //  * Draws the item to a canvas
    //  * @param {CanvasRenderingContext2D} context
    //  * @param {number} size
    //  */
    // drawFullSizeOnCanvas(context, size) {
    //     if (!this.cachedSprite) {
    //         this.cachedSprite = Loader.getSprite("sprites/fluids/" + this.fluid + ".png");
    //     }
    //     this.cachedSprite.drawCentered(context, size / 2, size / 2, size);
    // }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {DrawParameters} parameters
     */
    drawItemCenteredClipped(x, y, parameters, diameter = globalConfig.defaultItemDiameter) {
        const realDiameter = diameter * 0.6;
        if (!this.cachedSprite) {
            this.cachedSprite = Loader.getSprite("sprites/fluids/" + this.fluid + ".png");
        }
        this.cachedSprite.drawCachedCentered(parameters, x, y, realDiameter);
    }
}

/**
 * Singleton instances
 * @type {Object<enumFluids, FluidItem>}
 */
export const FLUID_ITEM_SINGLETONS = {};

for (const fluid in enumFluids) {
    FLUID_ITEM_SINGLETONS[fluid] = new FluidItem(fluid);
}
