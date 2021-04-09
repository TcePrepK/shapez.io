import { Component } from "../component";
import { types } from "../../savegame/serialization";
import { Entity } from "../entity";

export const enumStatusTypes = {
    on: "on",
    off: "off",
};

export const enumPistonTypes = {
    regular: "regular",
    sticky: "sticky",
};

export class PistonComponent extends Component {
    static getId() {
        return "Piston";
    }

    static getSchema() {
        return {
            type: types.string,
            status: types.string,
        };
    }

    /**
     * Copy the current state to another component
     * @param {PistonComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.type = this.type;
    }

    constructor() {
        super();
        this.type = "regular";
        this.status = enumStatusTypes.off;

        this.headSpan = 0;
    }
}
