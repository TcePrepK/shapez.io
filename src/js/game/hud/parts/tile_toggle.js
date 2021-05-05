import { globalConfig } from "../../../core/config";
import { STOP_PROPAGATION } from "../../../core/signal";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { isBombItem, NumberItem } from "../../items/number_item";
import { BaseHUDPart } from "../base_hud_part";

export class HUDTileToggle extends BaseHUDPart {
    initialize() {
        this.root.camera.downPreHandler.add(this.downPreHandler, this);
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    downPreHandler(pos, button) {
        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const lowerLayer = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
        if (!(lowerLayer instanceof NumberItem)) {
            return;
        }

        if (!lowerLayer.blocked) {
            return;
        }

        if (button === enumMouseButton.left) {
            if (lowerLayer.flagged) {
                return;
            }

            lowerLayer.blocked = false;
            lowerLayer.flagged = false;

            if (isBombItem(lowerLayer)) {
                this.root.gameOver = true;
            }

            if (lowerLayer.value === 0) {
                const w = globalConfig.tileSize;
                this.downPreHandler(new Vector(pos.x + w, pos.y), button);
                this.downPreHandler(new Vector(pos.x - w, pos.y), button);
                this.downPreHandler(new Vector(pos.x + w, pos.y + w), button);
                this.downPreHandler(new Vector(pos.x + w, pos.y - w), button);
                this.downPreHandler(new Vector(pos.x, pos.y + w), button);
                this.downPreHandler(new Vector(pos.x - w, pos.y - w), button);
                this.downPreHandler(new Vector(pos.x, pos.y - w), button);
                this.downPreHandler(new Vector(pos.x - w, pos.y + w), button);
            }
        } else if (button === enumMouseButton.right) {
            lowerLayer.flagged = !lowerLayer.flagged;
        }
    }
}
