import { Vector, enumDirection } from "../../core/vector";
import { LogicGateComponent, enumLogicGateType } from "../components/logic_gate";
import { RamComponent } from "../components/ram";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { MetaCutterBuilding } from "./cutter";
import { enumLogicGateVariants } from "./logic_gate";
import { MetaPainterBuilding } from "./painter";
import { MetaRotaterBuilding } from "./rotater";
import { MetaStackerBuilding } from "./stacker";
import { enumVirtualProcessorVariants } from "./virtual_processor";

/** @enum {string} */
export const enumBetterVirtualProcessorVariants = {
    default: "ram",
    smart_stacker: "smart_stacker",
    smart_stacker_inverse: "smart_stacker_inverse",
};

/** @enum {string} */
export const enumBetterVirtualProcessorToLogic = {
    smart_stacker: "smart_stacker",
    smart_stacker_inverse: "smart_stacker",
};

export class MetaBetterVirtualProcessorBuilding extends MetaBuilding {
    constructor() {
        super("better_virtual_processor");
    }

    getSilhouetteColor() {
        return "#555759";
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true; //root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing);
    }

    /** @returns {"wires"} **/
    getLayer() {
        return "wires";
    }

    getDimensions() {
        return new Vector(1, 1);
    }

    getAvailableVariants(root) {
        const betterVirtualProcessing = root.app.settings.getAllSettings().betterVirtualProcessing;
        return [
            defaultBuildingVariant,
            ...(betterVirtualProcessing ? [enumBetterVirtualProcessorVariants.smart_stacker] : []),
            ...(betterVirtualProcessing ? [enumBetterVirtualProcessorVariants.smart_stacker_inverse] : []),
        ];
    }

    getRenderPins() {
        // We already have it included
        return false;
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant: {
                entity.components.WiredPins.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);

                if (!entity.components.Ram) {
                    entity.addComponent(new RamComponent());
                }
                break;
            }
            case enumBetterVirtualProcessorVariants.smart_stacker:
            case enumBetterVirtualProcessorVariants.smart_stacker_inverse: {
                entity.components.WiredPins.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction:
                            variant === enumBetterVirtualProcessorVariants.smart_stacker_inverse
                                ? enumDirection.left
                                : enumDirection.right,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);

                if (!entity.components.LogicGate) {
                    entity.addComponent(
                        new LogicGateComponent({
                            type: enumBetterVirtualProcessorToLogic[variant],
                        })
                    );
                }
                break;
            }
        }
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new WiredPinsComponent({
                slots: [],
            })
        );
    }
}
