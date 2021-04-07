import { STOP_PROPAGATION } from "../../../core/signal";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { BaseHUDPart } from "../base_hud_part";

export class HUDButtonToggle extends BaseHUDPart {
    initialize() {
        this.root.camera.downPreHandler.add(this.downPreHandler, this);
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    downPreHandler(pos, button) {
        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (contents) {
            const buttonComp = contents.components.Button;
            if (buttonComp) {
                if (button === enumMouseButton.left && buttonComp.lifeSpan == 0) {
                    buttonComp.toggled = true;
                    buttonComp.lifeSpan = buttonComp.maxSpan;
                    return STOP_PROPAGATION;
                } else if (button === enumMouseButton.right) {
                    this.root.logic.tryDeleteBuilding(contents);
                    return STOP_PROPAGATION;
                }
            }
        }
    }
}
