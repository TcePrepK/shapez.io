import { Component } from "../component";

/** @enum {string} */
export const enumPipeType = {
    forward: "forward",
    turn: "turn",
    split: "split",
    cross: "cross",
};

/** @enum {string} */
export const enumPipeVariant = {
    pipe: "pipe",
    industrial: "industrial",
};

export class PipeComponent extends Component {
    static getId() {
        return "pipe";
    }

    /**
     * @param {object} param0
     * @param {enumPipeType=} param0.type
     * @param {enumPipeVariant=} param0.variant
     */
    constructor({ type = enumPipeType.forward, variant = enumPipeVariant.pipe }) {
        super();
        this.type = type;

        /**
         * The variant of the wire, different variants do not connect
         * @type {enumPipeVariant}
         */
        this.variant = variant;

        /**
         * @type {import("../systems/pipe").PipeNetwork}
         */
        this.linkedNetwork = null;
    }
}
