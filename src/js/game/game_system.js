import { globalConfig } from "../core/config";

/**
 * A game system processes all entities which match a given schema, usually a list of
 * required components. This is the core of the game logic.
 */
export class GameSystem {
    constructor() {
        this.root = globalConfig.root;
    }

    ///// PUBLIC API /////

    /**
     * Updates the game system, override to perform logic
     */
    update() {}

    /**
     * Override, do not call this directly, use startDraw()
     */
    draw() {}

    /**
     * Should refresh all caches
     */
    refreshCaches() {}

    /**
     * @see GameSystem.draw Wrapper arround the draw method
     */
    startDraw() {
        this.draw();
    }
}
