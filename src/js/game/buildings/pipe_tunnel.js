import { generateMatrixRotations } from "../../core/utils";
import { Vector } from "../../core/vector";
import { PipeTunnelComponent } from "../components/pipe_tunnel";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";

const pipeTunnelOverlayMatrix = generateMatrixRotations([0, 1, 0, 1, 1, 1, 0, 1, 0]);

export class MetaPipeTunnelBuilding extends MetaBuilding {
    constructor() {
        super("pipe_tunnel");
    }

    getSilhouetteColor() {
        return "#777a86";
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true; //root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_pipes_painter_and_levers);
    }

    /**
     *
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        return pipeTunnelOverlayMatrix[rotation];
    }

    getIsRotateable() {
        return false;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new PipeTunnelComponent());
    }
}
