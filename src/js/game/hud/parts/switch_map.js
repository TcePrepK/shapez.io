import { globalConfig } from "../../../core/config";
import { STOP_PROPAGATION } from "../../../core/signal";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { MapView } from "../../map_view";
import { BaseHUDPart } from "../base_hud_part";

export class HUDSwitchMap extends BaseHUDPart {
    initialize() {
        this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.switchMaps).add(this.switchMaps, this);

        this.allMaps = [];

        this.allMaps[0] = this.root.map;
        this.allMaps[1] = new MapView();
        this.allMaps[2] = new MapView(true, 6);
    }

    switchMaps() {
        const currentID = this.allMaps.indexOf(this.root.map);
        const nextID = (currentID + 1) % this.allMaps.length;
        const nextMap = this.allMaps[nextID];

        console.log(nextMap);
        this.root.map = nextMap;

        this.fixZoomAndPosition();
    }

    fixZoomAndPosition() {
        const camera = this.root.camera;
        camera.desiredZoom = camera.findInitialZoom();
        camera.centerOnMap();
    }
}
