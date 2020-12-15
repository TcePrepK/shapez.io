import { enumDirection, Vector } from "../../core/vector";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";

/** @enum {string} */
export const enumComplexMathGateVariants = {
    default: "cos",
    cot: "cot",
    csc: "csc",
    log: "log",
    sec: "sec",
    sin: "sin",
    sqrt: "sqrt",
    tan: "tan",
};

/** @enum {string} */
export const enumGateToLogic = {
    default: "cos",
    cot: "cot",
    csc: "csc",
    log: "log",
    sec: "sec",
    sin: "sin",
    sqrt: "sqrt",
    tan: "tan",
    round: "round",
};

const variantList = {
    sin: "sin",
    default: "cos",
    tan: "tan",
    cot: "cot",
    sec: "sec",
    csc: "csc",
    log: "log",
    sqrt: "sqrt",
    round: "round",
};

export class MetaComplexMathGatesBuilding extends MetaBuilding {
    constructor() {
        super("complex_math_gates");
    }

    getSilhouetteColor() {
        return "#7dcda2";
    }

    getDimensions(variant) {
        return new Vector(2, 1);
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
                operation: enumGateToLogic[variant],
                difficulty: "hard",
            })
        );
    }
}
