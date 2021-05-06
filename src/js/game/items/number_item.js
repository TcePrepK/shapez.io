import { DrawParameters } from "../../core/draw_parameters";
import { Loader } from "../../core/loader";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { globalConfig } from "../../core/config";
import { THEME } from "../theme";

export class NumberItem extends BaseItem {
    static getId() {
        return "number_item";
    }

    static getSchema() {
        return types.uint;
    }

    serialize() {
        return this.value;
    }

    deserialize(data) {
        this.value = data;
    }

    /** @returns {"number"} **/
    getItemType() {
        return "number";
    }

    /**
     * @param {number} value
     */
    constructor(value) {
        super();
        this.value = value;

        this.blocked = true;
        this.flagged = false;

        this.flaggedSprite = Loader.getSprite("sprites/misc/flag.png");
        this.blockedSprite = Loader.getSprite("sprites/misc/blocker.png");
    }

    getBackgroundColorAsResource() {
        if (this.blocked) {
            return THEME.map.grid;
        }

        if (isBombItem(this)) {
            return "#ff0000";
        }

        return THEME.map.grid;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} diameter
     * @param {DrawParameters} parameters
     */
    drawItemCenteredImpl(x, y, parameters, diameter = globalConfig.defaultItemDiameter) {
        if (this.flagged) {
            this.flaggedSprite.drawCachedCentered(parameters, x, y, globalConfig.tileSize);
            return;
        }

        if (this.blocked) {
            this.blockedSprite.drawCachedCentered(parameters, x, y, globalConfig.tileSize);
            return;
        }

        if (this.value === 0) {
            return;
        }

        const ctx = parameters.context;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.textAlign = "center";
        ctx.fillText(String(this.value), x, y + 8);
    }
}

/**
 * @param {BaseItem} item
 */
export function isBombItem(item) {
    if (!(item instanceof NumberItem)) {
        return false;
    }

    return item.value === -1;
}
