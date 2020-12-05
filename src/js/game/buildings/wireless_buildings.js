import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { WirelessDisplayComponent } from "../components/wireless_display";
import { enumHubGoalRewards } from "../tutorial_goals";
import { QuadSenderComponent } from "../components/quad_sender";
import { WirelessCodeComponent } from "../components/wireless_code";

/** @enum {string} */
export const enumWirelessBuildingsVariants = {
    remote_control: "remote_control",
    quad_sender: "quad_sender",
};

export class MetaWirelessBuildingsBuilding extends MetaBuilding {
    constructor(root) {
        super("wireless_buildings");
    }

    getSilhouetteColor() {
        return "#aaaaaa";
    }

    getIsRotateable(variant) {
        if (variant == enumWirelessBuildingsVariants.remote_control) {
            return true;
        }
        return false;
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        // @ts-ignore
        if (root.app.settings.getAllSettings().wirelessBuildingsMod) {
            return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_display);
        }
    }

    getAvailableVariants() {
        return [
            defaultBuildingVariant,
            enumWirelessBuildingsVariants.remote_control,
            enumWirelessBuildingsVariants.quad_sender,
        ];
    }

    getDimensions() {
        return new Vector(1, 1);
    }

    getShowWiresLayerPreview() {
        return true;
    }

    setupEntityComponents(entity) {
        entity.addComponent(new WirelessCodeComponent());
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
                if (!entity.components.WirelessDisplay) {
                    entity.addComponent(new WirelessDisplayComponent());
                }
                break;
            case enumWirelessBuildingsVariants.remote_control:
                if (!entity.components.WiredPins) {
                    entity.addComponent(new WiredPinsComponent({ slots: [] }));
                }
                if (!entity.components.WirelessDisplay) {
                    entity.addComponent(new WirelessDisplayComponent());
                }
                entity.components.WiredPins.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);
                break;
            case enumWirelessBuildingsVariants.quad_sender:
                if (!entity.components.WiredPins) {
                    entity.addComponent(new WiredPinsComponent({ slots: [] }));
                }
                if (!entity.components.QuadSender) {
                    entity.addComponent(new QuadSenderComponent());
                }
                if (!entity.components.WirelessDisplay) {
                    entity.addComponent(new WirelessDisplayComponent());
                }
                entity.components.WiredPins.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.right,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ]);
                break;
            default:
                break;
        }
    }
}
