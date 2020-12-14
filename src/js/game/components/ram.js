import { types } from "../../savegame/serialization";
import { Component } from "../component";

export class RamComponent extends Component {
    static getId() {
        return "Ram";
    }

    static getSchema() {
        return null;
    }

    constructor() {
        super();
    }
}
