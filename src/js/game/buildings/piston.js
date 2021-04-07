import { enumDirection, Vector } from "../../core/vector";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { WiredPinsComponent, enumPinSlotType } from "../components/wired_pins";
import { PistonComponent } from "../components/piston";

/** @enum {string} */
export const enumPistonVariants = { [defaultBuildingVariant]: "regular", sticky: "sticky" };

export class MetaPistonBuilding extends MetaBuilding {
    constructor() {
        super("piston");
    }

    getSilhouetteColor() {
        return "#000000";
    }

    getAvailableVariants() {
        return [defaultBuildingVariant, enumPistonVariants.sticky];
    }

    getIsUnlocked() {
        return true;
    }

    getSprite() {
        return null;
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
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.logicalAcceptor,
                    },
                ],
            })
        );

        entity.addComponent(new PistonComponent());
    }

    /**
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        entity.components.Piston.type = enumPistonVariants[variant];
    }
}
