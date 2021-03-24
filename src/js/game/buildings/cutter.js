import { formatItemsPerSecond } from "../../core/utils";
import { enumDirection, Vector } from "../../core/vector";
import { T } from "../../translations";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { defaultBuildingVariant, MetaBuilding } from "../meta_building";
import { enumHubGoalRewards } from "../tutorial_goals";

/** @enum {string} */
export const enumCutterVariants = { quad: "quad" };

export class MetaCutterBuilding extends MetaBuilding {
    constructor() {
        super("cutter");
    }

    getSilhouetteColor() {
        return "#7dcda2";
    }

    getDimensions(variant) {
        switch (variant) {
            case defaultBuildingVariant:
                return new Vector(2, 1);
            case enumCutterVariants.quad:
                return new Vector(4, 1);
            default:
                assertAlways(false, "Unknown cutter variant: " + variant);
        }
    }

    /**
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(variant) {
        const speed = this.root.hubGoals.getProcessorBaseSpeed(
            variant === enumCutterVariants.quad
                ? enumItemProcessorTypes.cutterQuad
                : enumItemProcessorTypes.cutter
        );
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    getAvailableVariants() {
        if (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_quad)) {
            return [defaultBuildingVariant, enumCutterVariants.quad];
        }
        return super.getAvailableVariants();
    }

    getIsUnlocked() {
        return this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_cutter_and_trash);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.cutter,
            })
        );
        entity.addComponent(new ItemEjectorComponent({}));
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

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant: {
                entity.components.ItemEjector.setSlots([
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                ]);
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cutter;
                break;
            }
            case enumCutterVariants.quad: {
                entity.components.ItemEjector.setSlots([
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                    { pos: new Vector(2, 0), direction: enumDirection.top },
                    { pos: new Vector(3, 0), direction: enumDirection.top },
                ]);
                entity.components.ItemProcessor.type = enumItemProcessorTypes.cutterQuad;
                break;
            }

            default:
                assertAlways(false, "Unknown painter variant: " + variant);
        }
    }
}
