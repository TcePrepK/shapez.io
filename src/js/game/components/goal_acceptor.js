import { globalConfig } from "../../core/config";
import { BaseItem } from "../base_item";
import { Component } from "../component";
import { typeItemSingleton } from "../item_resolver";

export class GoalAcceptorComponent extends Component {
    static getId() {
        return "GoalAcceptor";
    }

    static getSchema() {
        return {
            item: typeItemSingleton,
        };
    }

    static compressData(entry) {
        entry.ga = entry.components.GoalAcceptor.item.replace(/:/g, "");
    }

    static decompressData(entry) {
        const itemD = [];
        for (let i = 0, len = entry.ga.length; i < len; i += 8) {
            itemD.push(entry.ga.substr(i, 8));
        }
        const item = itemD.join(":");
        entry.components.GoalAcceptor = {
            item,
        };
    }

    /**
     * @param {object} param0
     * @param {BaseItem=} param0.item
     * @param {number=} param0.rate
     */
    constructor({ item = null, rate = null }) {
        super();

        // ths item to produce
        /** @type {BaseItem | undefined} */
        this.item = item;

        this.clear();
    }

    clear() {
        // the last items we delivered
        /** @type {{ item: BaseItem; time: number; }[]} */
        this.deliveryHistory = [];

        // Used for animations
        this.displayPercentage = 0;
    }

    getRequiredDeliveryHistorySize() {
        return (
            (globalConfig.puzzleModeSpeed *
                globalConfig.goalAcceptorMinimumDurationSeconds *
                globalConfig.beltSpeedItemsPerSecond) /
            globalConfig.goalAcceptorsPerProducer
        );
    }
}
