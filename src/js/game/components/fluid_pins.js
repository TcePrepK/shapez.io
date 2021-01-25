import { enumDirection, Vector } from "../../core/vector";
import { BaseItem } from "../base_item";
import { Component } from "../component";
import { types } from "../../savegame/serialization";
import { typeItemSingleton } from "../item_resolver";

/** @enum {string} */
export const enumPinSlotType = {
    fluidEjector: "fluidEjector",
    fluidAcceptor: "fluidAcceptor",
};

/** @typedef {{
 *   pos: Vector,
 *   type: enumPinSlotType,
 *   direction: enumDirection
 * }} FluidPinSlotDefinition */

/** @typedef {{
 *   pos: Vector,
 *   type: enumPinSlotType,
 *   direction: enumDirection,
 *   value: BaseItem,
 *   linkedNetwork: import("../systems/pipe").PipeNetwork
 * }} FluidPinSlot */

export class FluidPinsComponent extends Component {
    static getId() {
        return "FluidPins";
    }

    static getSchema() {
        return {
            slots: types.fixedSizeArray(
                types.structured({
                    value: types.nullable(typeItemSingleton),
                })
            ),
        };
    }

    /**
     * @param {object} param0
     * @param {Array<FluidPinSlotDefinition>} param0.slots
     */
    constructor({ slots = [] }) {
        super();
        this.setSlots(slots);
    }

    /**
     * Sets the slots of this building
     * @param {Array<FluidPinSlotDefinition>} slots
     */
    setSlots(slots) {
        /** @type {Array<FluidPinSlot>} */
        this.slots = [];

        for (let i = 0; i < slots.length; ++i) {
            const slotData = slots[i];
            this.slots.push({
                pos: slotData.pos,
                type: slotData.type,
                direction: slotData.direction,
                value: 0,
                linkedNetwork: null,
            });
        }
    }
}
