import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { WirelessSignalComponent } from "../components/wireless_signal";
import { DynamicRemoteSignalComponent } from "../components/dynamic_remote_signal";
import { WirelessCodeComponent } from "../components/wireless_code";

/** @enum {string} */
export const enumSignalTransportVariants = {
    dynamic_remote_signal: "dynamic_remote_signal",
    dynamic_remote_signal_reversed: "dynamic_remote_signal_reversed",
};

export class MetaSignalTransportBuilding extends MetaBuilding {
    constructor() {
        super("signal_transport");
    }

    getSilhouetteColor() {
        return "#aaaaaa";
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_display);
    }

    getAvailableVariants() {
        return [
            defaultBuildingVariant,
            enumSignalTransportVariants.dynamic_remote_signal,
            enumSignalTransportVariants.dynamic_remote_signal_reversed,
        ];
    }

    getDimensions() {
        return new Vector(1, 1);
    }

    getShowWiresLayerPreview() {
        return false;
    }

    setupEntityComponents(entity) {}

    /** @returns {"wires"} **/
    getLayer() {
        return "wires";
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant:
                if (!entity.components.WiredPins) {
                    entity.addComponent(new WiredPinsComponent({ slots: [] }));
                }
                if (!entity.components.WirelessSignal) {
                    entity.addComponent(new WirelessSignalComponent());
                }
                if (!entity.components.WirelessCode) {
                    entity.addComponent(new WirelessCodeComponent());
                }
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
                break;
            case enumSignalTransportVariants.dynamic_remote_signal_reversed:
            case enumSignalTransportVariants.dynamic_remote_signal:
                if (!entity.components.WiredPins) {
                    entity.addComponent(new WiredPinsComponent({ slots: [] }));
                }
                if (!entity.components.DynamicRemoteSignal) {
                    entity.addComponent(new DynamicRemoteSignalComponent());
                }
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
                            variant === enumSignalTransportVariants.dynamic_remote_signal
                                ? enumDirection.left
                                : enumDirection.right,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);
                break;
            default:
                break;
        }
    }
}
