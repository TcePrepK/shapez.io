import { enumDirection, Vector } from "../../core/vector";
import { Component } from "../component";
import { defaultBuildingVariant } from "../meta_building";

export const curvedPipeLength = /* Math.PI / 4 */ 0.78;

/** @enum {string} */
export const enumPipeVariant = {
    pipe: "pipe",
    industrial: "industrial",
};

export const FAKE_PIPE_ACCEPTOR_SLOT = {
    pos: new Vector(0, 0),
    directions: [enumDirection.bottom],
};

export const FAKE_PIPE_EJECTOR_SLOT_BY_DIRECTION = {
    [enumDirection.top]: {
        pos: new Vector(0, 0),
        direction: enumDirection.top,
    },

    [enumDirection.right]: {
        pos: new Vector(0, 0),
        direction: enumDirection.right,
    },

    [enumDirection.left]: {
        pos: new Vector(0, 0),
        direction: enumDirection.left,
    },
};

export class PipeComponent extends Component {
    static getId() {
        return "Pipe";
    }

    /**
     * @param {object} param0
     * @param {enumPipeVariant=} param0.variant
     */
    constructor({ variant = defaultBuildingVariant }) {
        super();
        // this.type = type;
        this.direction = enumDirection.top;

        /**
         * The variant of the wire, different variants do not connect
         * @type {enumPipeVariant}
         */
        this.variant = variant;

        this.currentValue = null;
        this.currentAmount = 0;
    }

    /**
     * Returns the effective length of this pipe in tile space
     * @returns {number}
     */
    getEffectiveLengthTiles() {
        return this.direction === enumDirection.top ? 1.0 : curvedPipeLength;
    }

    /**
     * Returns fake acceptor slot used for matching
     */
    getFakeAcceptorSlot() {
        return FAKE_PIPE_ACCEPTOR_SLOT;
    }

    /**
     * Returns fake acceptor slot used for matching
     */
    getFakeEjectorSlot() {
        return FAKE_PIPE_EJECTOR_SLOT_BY_DIRECTION[this.direction];
    }

    /**
     * Converts from pipe space (0 = start of pipe ... 1 = end of pipe) to the local
     * pipe coordinates (-0.5|-0.5 to 0.5|0.5)
     * @param {number} progress
     * @returns {Vector}
     */
    transformPipeToLocalSpace(progress) {
        assert(progress >= 0.0, "Invalid progress ( < 0): " + progress);
        switch (this.direction) {
            case enumDirection.top:
                assert(progress <= 1.02, "Invalid progress: " + progress);
                return new Vector(0, 0.5 - progress);

            case enumDirection.right: {
                assert(progress <= curvedPipeLength + 0.02, "Invalid progress 2: " + progress);
                const arcProgress = (progress / curvedPipeLength) * 0.5 * Math.PI;
                return new Vector(0.5 - 0.5 * Math.cos(arcProgress), 0.5 - 0.5 * Math.sin(arcProgress));
            }
            case enumDirection.left: {
                assert(progress <= curvedPipeLength + 0.02, "Invalid progress 3: " + progress);
                const arcProgress = (progress / curvedPipeLength) * 0.5 * Math.PI;
                return new Vector(-0.5 + 0.5 * Math.cos(arcProgress), 0.5 - 0.5 * Math.sin(arcProgress));
            }
            default:
                assertAlways(false, "Invalid pipe direction: " + this.direction);
                return new Vector(0, 0);
        }
    }
}
