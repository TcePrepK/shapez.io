import { enumDirection, Vector } from "../../core/vector";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { ItemAcceptorComponent } from "../components/item_acceptor";

/** @enum {string} */
export const enumCornerEditerVariants = {
    remover: "remover",
};

export class MetaCornerEditorBuilding extends MetaBuilding {
    constructor() {
        super("corner_editor");
    }

    getSilhouetteColor(variant) {
        return "#414141";
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true;
    }

    getAvailableVariants() {
        return [defaultBuildingVariant, enumCornerEditerVariants.remover];
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant: {
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cornerAdder;
                break;
            }
            case enumCornerEditerVariants.remover: {
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cornerRemover;
                break;
            }
            default:
                assertAlways(false, "Unknown corner editor variant: " + variant);
        }
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new ItemProcessorComponent({}));

        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
            })
        );
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                        filter: "shape",
                    },
                ],
            })
        );
    }
}
