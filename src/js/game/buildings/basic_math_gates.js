import { enumDirection, Vector } from "../../core/vector";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";

/** @enum {string} */
export const enumBasicMathGateVariants = {
    default: "addition",
    multiplication: "multiplication",
    subtraction: "subtraction",
    division: "division",
    modulo: "modulo",
    powerof: "powerof",
    greater: "greater",
    less: "less",
};

const variantList = {
    default: "addition",
    subtraction: "subtraction",
    multiplication: "multiplication",
    division: "division",
    modulo: "modulo",
    powerof: "powerof",
    greater: "greater",
    less: "less",
};

export class MetaBasicMathGatesBuilding extends MetaBuilding {
    constructor() {
        super("basic_math_gates");
    }

    getSilhouetteColor() {
        return "#7dcda2";
    }

    getDimensions(variant) {
        return new Vector(2, 2);
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        // @ts-ignore
        if (root.app.settings.getAllSettings().mathGatesMod) {
            let arr = [];
            for (const variant in variantList) {
                arr.push(variant);
            }
            return arr;
        }
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true; //root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_and_trash);
    }

    /** @returns {"wires"} **/
    getLayer() {
        return "wires";
    }

    getRenderPins() {
        // We already have it included
        return false;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new WiredPinsComponent({
                slots: [
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.right,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 1),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        );
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        if (entity.components.LogicGate) {
            return;
        }

        entity.addComponent(
            new LogicGateComponent({
                type: enumLogicGateType.math,
                operation: enumBasicMathGateVariants[variant],
                difficulty: "basic",
            })
        );
    }
}
