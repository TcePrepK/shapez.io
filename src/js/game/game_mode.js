import { globalConfig } from "../core/config";
import { enumHubGoalRewards } from "./tutorial_goals";

/** @typedef {{
 *   shape: string,
 *   amount: number
 * }} UpgradeRequirement */

/** @typedef {{
 *   required: Array<UpgradeRequirement>
 *   improvement?: number,
 *   excludePrevious?: boolean
 * }} TierRequirement */

/** @typedef {Array<TierRequirement>} UpgradeTiers */

/** @typedef {{
 *   shape: string,
 *   required: number,
 *   reward: enumHubGoalRewards,
 *   throughputOnly?: boolean
 * }} LevelDefinition */

export class GameMode {
    constructor() {
        this.root = globalConfig.root;
    }

    /**
     * Should return all available upgrades
     * @returns {Object<string, UpgradeTiers>}
     */
    getUpgrades() {
        abstract;
        return null;
    }

    /**
     * Returns the blueprint shape key
     * @returns {string}
     */
    getBlueprintShapeKey() {
        abstract;
        return null;
    }

    /**
     * Returns the goals for all levels including their reward
     * @returns {Array<LevelDefinition>}
     */
    getLevelDefinitions() {
        abstract;
        return null;
    }

    /**
     * Should return whether free play is available or if the game stops
     * after the predefined levels
     * @returns {boolean}
     */
    getIsFreeplayAvailable() {
        return true;
    }
}
