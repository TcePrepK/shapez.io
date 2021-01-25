import { types } from "../../savegame/serialization";
import { Component } from "../component";

export class FluidComponent extends Component {
    static getId() {
        return "Fluid";
    }

    // static getSchema() {
    //     return {
    //         system: types.object,
    //     };
    // }

    constructor() {
        super();
        this.system = {
            source: null,
            fluid: null,
            length: null,
            pressure: null,
        };
    }
}
