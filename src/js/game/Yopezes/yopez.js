import { DrawParameters } from "../../core/draw_parameters";
import { Vector } from "../../core/vector";
import { GameRoot } from "../root";
import { ShapeDefinition } from "../shape_definition";

export class Yopez extends Vector {
    /**
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     * @param {ShapeDefinition} definition
     */
    constructor(root, x, y, definition) {
        super(x, y);
        this.root = root;

        /**
         * Shape that we use for drawing
         */
        this.definition = definition;

        /**
         * Don't draw circle underneath :)
         */
        this.definition.drawCircle = false;
    }

    /**
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        this.definition.drawCentered(this.x, this.y, parameters);
    }
}
