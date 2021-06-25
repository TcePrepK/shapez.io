import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { Component } from "../component";
import { typeItemSingleton, typeResolverSingleton } from "../item_resolver";

export class ConstantSignalComponent extends Component {
    static getId() {
        return "ConstantSignal";
    }

    static getSchema() {
        return {
            signal: types.nullable(typeItemSingleton),
        };
    }

    static compressData(entry) {
        if (entry.components.ConstantSignal.signal == null) return;

        entry.cs = entry.components.ConstantSignal.signal.data.replace(/:/g, "");
    }

    static decompressData(entry) {
        const itemD = [];
        for (let i = 0, len = entry.cs.length; i < len; i += 8) {
            itemD.push(entry.cs.substr(i, 8));
        }
        const item = itemD.join(":");

        const type = typeResolverSingleton(item);
        entry.components.ConstantSignal = {
            signal: { $: type, data: item },
        };
    }

    /**
     * Copy the current state to another component
     * @param {ConstantSignalComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.signal = this.signal;
    }

    /**
     *
     * @param {object} param0
     * @param {BaseItem=} param0.signal The signal to store
     */
    constructor({ signal = null }) {
        super();
        this.signal = signal;
    }
}
