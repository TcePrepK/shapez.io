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
        if (this.root.camera.getIsMapOverlayActive()) {
            return;
        }

        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        this.handleTileToggle(tile, button, true);
    }

    /**
     * @param {Vector} tile
     * @param {enumMouseButton} button
     * @param {boolean} manual
     * @returns
     */
    handleTileToggle(tile, button, manual = false) {
        const lowerLayer = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
        if (!(lowerLayer instanceof NumberItem)) {
            return;
        }

        if (!lowerLayer.blocked) {
            if (!manual || button === enumMouseButton.right) {
                return;
            }

            this.handleTileToggle(tile.addScalars(0, -1), button); //  0
            this.handleTileToggle(tile.addScalars(1, -1), button); //  45
            this.handleTileToggle(tile.addScalars(1, 0), button); //   90
            this.handleTileToggle(tile.addScalars(1, 1), button); //   135
            this.handleTileToggle(tile.addScalars(0, 1), button); //   180
            this.handleTileToggle(tile.addScalars(-1, 1), button); //  225
            this.handleTileToggle(tile.addScalars(-1, 0), button); //  270
            this.handleTileToggle(tile.addScalars(-1, -1), button); // 315
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
                this.handleTileToggle(tile.addScalars(0, -1), button); //  0
                this.handleTileToggle(tile.addScalars(1, -1), button); //  45
                this.handleTileToggle(tile.addScalars(1, 0), button); //   90
                this.handleTileToggle(tile.addScalars(1, 1), button); //   135
                this.handleTileToggle(tile.addScalars(0, 1), button); //   180
                this.handleTileToggle(tile.addScalars(-1, 1), button); //  225
                this.handleTileToggle(tile.addScalars(-1, 0), button); //  270
                this.handleTileToggle(tile.addScalars(-1, -1), button); // 315
            }
        } else if (button === enumMouseButton.right) {
            lowerLayer.flagged = !lowerLayer.flagged;
        }
    }
}
