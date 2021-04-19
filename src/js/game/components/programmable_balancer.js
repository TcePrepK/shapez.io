import { types } from "../../savegame/serialization";
import { Component } from "../component";

export class ProgrammableBalancerComponent extends Component {
    static getId() {
        return "ProgrammableBalancer";
    }

    static getSchema() {
        return {
            word: types.string,
        };
    }

    /**
     * Copy the current state to another component
     * @param {ProgrammableBalancerComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.word = this.word;
    }

    /**
     * @param {string} word
     */
    constructor(word = "out/in/out/out") {
        super();
        this.word = word;
    }
}
