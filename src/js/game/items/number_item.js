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

        this.bombSprite = Loader.getSprite("sprites/misc/minesweeper_bomb.png");
        this.flaggedTileSprite = Loader.getSprite("sprites/misc/minesweeper_flag.png");
        this.blockedTileSprite = Loader.getSprite("sprites/misc/minesweeper_blocker.png");
    }

    getBackgroundColorAsResource() {
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
            this.flaggedTileSprite.drawCachedCentered(parameters, x, y, globalConfig.tileSize);
            return;
        }

        if (this.blocked) {
            this.blockedTileSprite.drawCachedCentered(parameters, x, y, globalConfig.tileSize);
            return;
        }

        if (isBombItem(this)) {
            this.bombSprite.drawCachedCentered(parameters, x, y, globalConfig.tileSize);
            return;
        }

        if (this.value === 0) {
            return;
        }

        parameters.context.fillStyle = "white";
        parameters.context.strokeStyle = "black";
        parameters.context.textAlign = "center";
        parameters.context.fillText(String(this.value), x, y + 8);
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
