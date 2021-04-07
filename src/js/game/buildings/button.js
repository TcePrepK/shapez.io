import { enumDirection, Vector } from "../../core/vector";
import { enumPinSlotType, WiredPinsComponent } from "../components/wired_pins";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";
import { ButtonComponent } from "../components/button";

export class MetaButtonBuilding extends MetaBuilding {
    constructor() {
        super("button");
    }

    getSilhouetteColor() {
        // @todo: Render differently based on if its activated or not
        return "#1a678b";
    }

    getIsUnlocked() {
        return true;
    }

    getSprite() {
        return null;
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
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalEjector,
                    },
                ],
            })
        );

        entity.addComponent(new ButtonComponent({}));
    }
}
