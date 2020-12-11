import { Component } from "../component";

/** @enum {string} */
export const enumLogicGateType = {
    and: "and",
    not: "not",
    xor: "xor",
    or: "or",
    transistor: "transistor",

    analyzer: "analyzer",
    rotater: "rotater",
    unstacker: "unstacker",
    cutter: "cutter",
    compare: "compare",
    stacker: "stacker",
    painter: "painter",

    // ModZ

    math: "math",
};

export class LogicGateComponent extends Component {
    static getId() {
        return "LogicGate";
    }

    /**
     *
     * @param {object} param0
     * @param {enumLogicGateType=} param0.type
     * @param {string} param0.operation
     * @param {string} param0.difficulty
     */
    constructor({ type = enumLogicGateType.and, operation, difficulty }) {
        super();
        this.type = type;
        this.operation = operation;
        this.difficulty = difficulty;
    }
}
