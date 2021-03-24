import { globalConfig } from "../core/config";

export class AnalyticsInterface {
    constructor() {
        this.app = globalConfig.app;
    }

    /**
     * Initializes the analytics
     * @returns {Promise<void>}
     */
    initialize() {
        abstract;
        return Promise.reject();
    }

    /**
     * Sets the player name for analytics
     * @param {string} userName
     */
    setUserContext(userName) {}

    /**
     * Tracks a click no an ui element
     * @param {string} elementName
     */
    trackUiClick(elementName) {}

    /**
     * Tracks when a new state is entered
     * @param {string} stateId
     */
    trackStateEnter(stateId) {}

    /**
     * Tracks a new user decision
     * @param {string} name
     */
    trackDecision(name) {}
}
