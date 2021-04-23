import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { MapView } from "../../map_view";
import { BaseHUDPart } from "../base_hud_part";

export class HUDTrashWorlds extends BaseHUDPart {
    initialize() {
        this.root.camera.downPreHandler.add(this.downPreHandler, this);

        this.allTrashMaps = {};
    }

    /**
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    // @ts-ignore
    downPreHandler(pos, button) {
        if (this.root.currentLayer === "wires") {
            return;
        }

        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const content = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!content) {
            return;
        }

        const trashComp = content.components.Trash;
        if (!trashComp) {
            return;
        }

        this.root.map.trashMap = !this.root.map.trashMap;
    }
}
