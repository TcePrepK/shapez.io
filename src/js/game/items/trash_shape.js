import { BaseItem } from "../base_item";
import { globalConfig } from "../../core/config";
import { ShapeItem } from "./shape_item";

export class TrashShapeItem extends BaseItem {
    static getId() {
        return "trash_shape";
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
    }

    updateFalling() {
        if (this.falling < 0) {
            this.falling += 8;
        }
    }
}
