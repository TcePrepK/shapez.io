import { Component } from "../component";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { typeItemSingleton } from "../item_resolver";

export class WirelessCodeComponent extends Component {
    static getId() {
        return "WirelessCode";
    }

    static getSchema() {
        return {
            wireless_code: types.string,
        };
    }

    /**
     * Copy the current state to another component
     * @param {WirelessCodeComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.wireless_code = this.wireless_code;
    }

    /**
     *
     * @param {string} wireless_code
     */
    constructor(wireless_code = "") {
        super();
        this.wireless_code = wireless_code;
    }
}
