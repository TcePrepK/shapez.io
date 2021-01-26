import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { Component } from "../component";
import { Entity } from "../entity";
import { typeItemSingleton } from "../item_resolver";

const chainBufferSize = 6;

export class PumpComponent extends Component {
    static getId() {
        return "Pump";
    }

    static getSchema() {
        // cachedMinedItem is not serialized.
        return {
            fluidChainBuffer: types.array(typeItemSingleton),
        };
    }

    constructor() {
        super();
        this.chainable = false;

        /**
         * Stores items from other pumps which were chained to this
         * pump.
         * @type {Array<BaseItem>}
         */
        this.fluidChainBuffer = [];

        /**
         * @type {BaseItem}
         */
        this.cachedPumpedFluid = null;

        /**
         * Which pump this pump ejects to, in case its a chainable one.
         * If the value is false, it means there is no entity, and we don't have to re-check
         * @type {Entity|null|false}
         */
        this.cachedChainedPump = null;
    }

    /**
     *
     * @param {BaseItem} item
     */
    tryAcceptChainedFluid(item) {
        if (this.fluidChainBuffer.length > chainBufferSize) {
            // Well, this one is full
            return false;
        }

        this.fluidChainBuffer.push(item);
        return true;
    }
}
