import { makeDiv } from "../../../core/utils";
import { BaseHUDPart } from "../base_hud_part";

export class HUDTileToggle extends BaseHUDPart {
    constructor(root) {
        super(root);
    }

    /**
     * Should create all require elements
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(
            parent,
            "ingame_HUD_Scoreboard",
            [],
            `<h2 id="scoreboard">CURRENT SCORE: 0 </h2>`
        );
    }

    initialize() {}
}
