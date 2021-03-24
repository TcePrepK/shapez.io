import { ClickDetector } from "../../core/click_detector";
import { globalConfig } from "../../core/config";
import { KeyActionMapper } from "../key_action_mapper";

export class BaseHUDPart {
    constructor() {
        this.root = globalConfig.root;
        this.app = globalConfig.app;

        /** @type {Array<ClickDetector>} */
        this.clickDetectors = [];
    }

    /**
     * Should create all require elements
     * @param {HTMLElement} parent
     */
    createElements(parent) {}

    /**
     * Should initialize the element, called *after* the elements have been created
     */
    initialize() {
        abstract;
    }

    /**
     * Should update any required logic
     */
    update() {}

    /**
     * Should draw the hud
     */
    draw() {}

    /**
     * Should draw any overlays (screen space)
     */
    drawOverlays() {}

    /**
     * Should return true if the widget has a modal dialog opened and thus
     * the game does not need to update / redraw
     * @returns {boolean}
     */
    shouldPauseRendering() {
        return false;
    }

    /**
     * Should return false if the game should be paused
     * @returns {boolean}
     */
    shouldPauseGame() {
        return false;
    }

    /**
     * Should return true if this overlay is open and currently blocking any user interaction
     */
    isBlockingOverlay() {
        return false;
    }

    /**
     * Cleans up the hud element, if overridden make sure to call super.cleanup
     */
    cleanup() {
        this.cleanupClickDetectors();
    }

    /**
     * Cleans up all click detectors
     */
    cleanupClickDetectors() {
        if (this.clickDetectors) {
            for (let i = 0; i < this.clickDetectors.length; ++i) {
                this.clickDetectors[i].cleanup();
            }
            this.clickDetectors = [];
        }
    }

    /**
     * Should close the element, in case its supported
     */
    close() {}

    // Helpers

    /**
     * Helper method to construct a new click detector
     * @param {Element} element The element to listen on
     * @param {function} handler The handler to call on this object
     * @param {import("../../core/click_detector").ClickDetectorConstructorArgs=} args Click detector arguments
     *
     */
    trackClicks(element, handler, args = {}) {
        const detector = new ClickDetector(element, args);
        detector.click.add(handler, this);
        this.registerClickDetector(detector);
    }

    /**
     * Registers a new click detector
     * @param {ClickDetector} detector
     */
    registerClickDetector(detector) {
        this.clickDetectors.push(detector);
        if (G_IS_DEV) {
            // @ts-ignore
            detector._src = "hud-" + this.constructor.name;
        }
    }

    /**
     * Closes this element when its background is clicked
     * @param {HTMLElement} element
     * @param {function} closeMethod
     */
    closeOnBackgroundClick(element, closeMethod = null) {
        const bgClickDetector = new ClickDetector(element, {
            preventDefault: true,
            targetOnly: true,
            applyCssClass: null,
            consumeEvents: true,
            clickSound: null,
        });

        // If the state defines a close method, use that as fallback
        // @ts-ignore
        bgClickDetector.touchend.add(closeMethod || this.close, this);
        this.registerClickDetector(bgClickDetector);
    }

    /**
     * Forwards the game speed keybindings so you can toggle pause / Fastforward
     * in the building tooltip and such
     * @param {KeyActionMapper} sourceMapper
     */
    forwardGameSpeedKeybindings(sourceMapper) {
        sourceMapper.forward(this.root.keyMapper, ["gamespeed_pause", "gamespeed_fastforward"]);
    }

    /**
     * Forwards the map movement keybindings so you can move the map with the
     * arrow keys
     * @param {KeyActionMapper} sourceMapper
     */
    forwardMapMovementKeybindings(sourceMapper) {
        sourceMapper.forward(this.root.keyMapper, [
            "mapMoveUp",
            "mapMoveRight",
            "mapMoveDown",
            "mapMoveLeft",
        ]);
    }
}
