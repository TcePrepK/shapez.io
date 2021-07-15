import { DrawParameters } from "../../core/draw_parameters";
import { GameRoot } from "../root";
import { ShapeDefinition } from "../shape_definition";
import { Yopez } from "./yopez";

export class PlayerYopez extends Yopez {
    /**
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     * @param {ShapeDefinition} definition
     */
    constructor(root, x, y, definition) {
        super(root, x, y, definition);

        /**
         * Yopezes current rotation
         * @type {number}
         */
        this.currentRotation;

        /**
         * Yopezes will try to turn into this angle
         * @type {number}
         */
        this.desiredRotation;
    }

    update() {
        if (this.currentRotation == this.desiredRotation) return;

        let diff = this.desiredRotation - this.currentRotation;
        if (diff > 180) diff -= 360;

        if (diff < -180) diff += 360;

        this.currentRotation += diff / 18;

        this.currentRotation = (this.currentRotation + 360) % 360;
        this.desiredRotation = (this.desiredRotation + 360) % 360;
    }

    /**
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        const angle = Math.radians(this.currentRotation);

        const ctx = parameters.context;
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        this.definition.drawCentered(0, 0, parameters);
        ctx.rotate(-angle);
        ctx.translate(-this.x, -this.y);
    }
}
