import { enumDirection, Vector } from "../../core/vector";
import { CommandControllerComponent } from "../components/command_controller";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";

export class MetaCommandControllerBuilding extends MetaBuilding {
    constructor() {
        super("command_controller");
    }

    getSilhouetteColor() {
        return "#000000";
    }

    getIsUnlocked() {
        return true; //root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_virtual_processing);
    }

    getDimensions() {
        return new Vector(3, 3);
    }

    getRenderPins() {
        // We already have it included
        return true;
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
                        pos: new Vector(1, 2),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        );

        entity.addComponent(new CommandControllerComponent());
    }
}
