import { Vector } from "../../core/vector";
import { Component } from "../component";

export class StickyComponent extends Component {
    static getId() {
        return "Sticky";
    }

    /**
     * @param {Array<Vector>} sides
     */
    constructor(sides = []) {
        super();
        this.setSides(sides);
    }

    /**
     * Sets the slots of this building
     * @param {Array<Vector>} sides
     */
    setSides(sides) {
        this.sides = sides;
    }
}
