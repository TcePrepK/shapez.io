import { enumDirection, enumDirectionToVector, Vector } from "../../core/vector";
import { types } from "../../savegame/serialization";
import { BaseItem } from "../base_item";
import { PipePath } from "../pipe_path";
import { Component } from "../component";
import { Entity } from "../entity";
import { typeItemSingleton } from "../item_resolver";

/**
 * @typedef {{
 *    pos: Vector,
 *    direction: enumDirection,
 *    fluid: BaseItem,
 *    progress: number?,
 *    cachedDestSlot?: import("./fluid_acceptor").FluidAcceptorLocatedSlot,
 *    cachedPipePath?: PipePath,
 *    cachedTargetEntity?: Entity
 * }} FluidEjectorSlot
 */

export class FluidEjectorComponent extends Component {
    static getId() {
        return "FluidEjector";
    }

    static getSchema() {
        // The cachedDestSlot, cachedTargetEntity fields are not serialized.
        return {
            slots: types.fixedSizeArray(
                types.structured({
                    fluid: types.nullable(typeItemSingleton),
                    progress: types.float,
                })
            ),
        };
    }

    /**
     *
     * @param {object} param0
     * @param {Array<{pos: Vector, direction: enumDirection }>=} param0.slots The slots to eject on
     * @param {boolean=} param0.renderFloatingFluids Whether to render fluids even if they are not connected
     */
    constructor({ slots = [], renderFloatingFluids = true }) {
        super();

        this.setSlots(slots);
        this.renderFloatingFluids = renderFloatingFluids;
    }

    /**
     * @param {Array<{pos: Vector, direction: enumDirection }>} slots The slots to eject on
     */
    setSlots(slots) {
        /** @type {Array<FluidEjectorSlot>} */
        this.slots = [];
        for (let i = 0; i < slots.length; ++i) {
            const slot = slots[i];
            this.slots.push({
                pos: slot.pos,
                direction: slot.direction,
                fluid: null,
                progress: 0,
                cachedDestSlot: null,
                cachedTargetEntity: null,
            });
        }
    }

    /**
     * Returns where this slot ejects to
     * @param {FluidEjectorSlot} slot
     * @returns {Vector}
     */
    getSlotTargetLocalTile(slot) {
        const directionVector = enumDirectionToVector[slot.direction];
        return slot.pos.add(directionVector);
    }

    /**
     * Returns whether any slot ejects to the given local tile
     * @param {Vector} tile
     */
    anySlotEjectsToLocalTile(tile) {
        for (let i = 0; i < this.slots.length; ++i) {
            if (this.getSlotTargetLocalTile(this.slots[i]).equals(tile)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns if we can eject on a given slot
     * @param {number} slotIndex
     * @returns {boolean}
     */
    canEjectOnSlot(slotIndex) {
        assert(slotIndex >= 0 && slotIndex < this.slots.length, "Invalid ejector slot: " + slotIndex);
        return !this.slots[slotIndex].fluid;
    }

    /**
     * Returns the first free slot on this ejector or null if there is none
     * @returns {number?}
     */
    getFirstFreeSlot() {
        for (let i = 0; i < this.slots.length; ++i) {
            if (this.canEjectOnSlot(i)) {
                return i;
            }
        }
        return null;
    }

    /**
     * Tries to eject a given fluid
     * @param {number} slotIndex
     * @param {BaseItem} fluid
     * @returns {boolean}
     */
    tryEject(slotIndex, fluid) {
        if (!this.canEjectOnSlot(slotIndex)) {
            return false;
        }
        this.slots[slotIndex].fluid = fluid;
        this.slots[slotIndex].progress = 0;
        console.log("something");
        return true;
    }

    /**
     * Clears the given slot and returns the fluid it had
     * @param {number} slotIndex
     * @returns {BaseItem|null}
     */
    takeSlotFluid(slotIndex) {
        const slot = this.slots[slotIndex];
        const fluid = slot.fluid;
        slot.fluid = null;
        slot.progress = 0.0;
        return fluid;
    }
}
