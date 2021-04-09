import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";
import { DisplayComponent } from "../components/display";
import { enumHubGoalRewards } from "../tutorial_goals";
import { ObserverComponent } from "../components/observer";

export class MetaObserverBuilding extends MetaBuilding {
    constructor() {
        super("observer");
    }

    getSilhouetteColor() {
        return "#000000";
    }

    getIsUnlocked() {
        return true;
    }

    getShowWiresLayerPreview() {
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
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.logicalEjector,
                    },
                ],
            })
        );

        entity.addComponent(new ObserverComponent());
    }
}
