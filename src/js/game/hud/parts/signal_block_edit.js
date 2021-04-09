import { STOP_PROPAGATION } from "../../../core/signal";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { BaseHUDPart } from "../base_hud_part";

export class HUDSignalBlockEdit extends BaseHUDPart {
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
            const signalComp = contents.components.SignalBlock;
            if (signalComp) {
                if (button === enumMouseButton.left) {
                    this.root.systemMgr.systems.signalBlock.editSignalBlock(contents, {
                        deleteOnCancel: false,
                    });
                    return STOP_PROPAGATION;
                }
            }
        }
    }
}
