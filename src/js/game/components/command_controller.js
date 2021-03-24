import { types } from "../../savegame/serialization";
import { Component } from "../component";

export class CommandControllerComponent extends Component {
    static getId() {
        return "CommandController";
    }

    static getSchema() {
        return {
            command: types.string,
        };
    }

    /**
     * Copy the current state to another component
     * @param {CommandControllerComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.command = this.command;
    }

    /**
     * @param {string} command
     */
    constructor(command = "") {
        super();
        this.command = command;
    }
}
