import { enumDirection, Vector } from "../../core/vector";
import { ItemEjectorComponent } from "../components/item_ejector";
import { MinerComponent } from "../components/miner";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { enumHubGoalRewards } from "../tutorial_goals";
import { T } from "../../translations";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";

/** @enum {string} */
export const enumMinerVariants = { chainable: "chainable" };

const overlayMatrix = {
    [defaultBuildingVariant]: generateMatrixRotations([1, 1, 1, 1, 0, 1, 1, 1, 1]),
    [enumMinerVariants.chainable]: generateMatrixRotations([0, 1, 0, 1, 1, 1, 1, 1, 1]),
};

export class MetaMinerBuilding extends MetaBuilding {
    constructor() {
        super("miner");
    }

    getSilhouetteColor() {
        return "#b37dcd";
    }

    /**
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics() {
        const speed = this.root.hubGoals.getMinerBaseSpeed();
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    getAvailableVariants() {
        if (this.root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_miner_chainable)) {
            return [enumMinerVariants.chainable];
        }
        return super.getAvailableVariants();
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        return overlayMatrix[variant][rotation];
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new MinerComponent({}));
        entity.addComponent(
            new ItemEjectorComponent({
                slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
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
        entity.components.Miner.chainable = variant === enumMinerVariants.chainable;
    }
}
