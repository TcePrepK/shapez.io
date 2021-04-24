import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { BaseItem } from "../base_item";
import { ColorItem } from "./color_item";

export class TrashColorItem extends BaseItem {
    static getId() {
        return "trash_color";
    }

    /**
     * @param {ColorItem} item
     */
    constructor(item) {
        super();

        this.item = item;
        this.rotation = Math.random() * 360;
        this.offX = (Math.random() - 0.5) * 500;
        this.offY = (Math.random() - 0.5) * 500;

        this.falling = -1000;
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
        const sprite = Loader.getSprite("sprites/colors/" + this.item.color + ".png");
        sprite.drawCachedCentered(0, 0, diameter * 0.6);
        ctx.rotate(-alpha);
        ctx.translate(-this.offX - x, -this.offY - this.falling - y);
    }

    updateFalling() {
        if (this.falling < 0) {
            this.falling += 8;
        }
    }
}
