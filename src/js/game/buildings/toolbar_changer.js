import { Vector } from "../../core/vector";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";
import { GameRoot } from "../root";
export class MetaToolbarChangerBuilding extends MetaBuilding {
    constructor() {
        super("toolbar_changer");
    }

    getDimensions() {
        return new Vector(1, 1);
    }

    getSilhouetteColor() {}

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return true; //root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_mixer);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {}
}
