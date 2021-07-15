import { BaseHUDPart } from "../base_hud_part";
import { DrawParameters } from "../../../core/draw_parameters";
import { Yopez } from "../../components/builder";

export class HUDPlayerHandler extends BaseHUDPart {
    initialize() {
        const lvl17 = this.root.shapeDefinitionMgr.getShapeFromShortKey("WrRgWrRg:CwCrCwCr:SgSgSgSg");
        const camPos = this.root.camera.center.copy();
        this.player = new Yopez(this.root, camPos.x, camPos.y, 0, lvl17);
        this.player.currentRotation = 0;
        this.player.desiredRotation = 0;
    }

    update() {
        const camera = this.root.camera;
        const oldPos = this.player.copy();
        const newPos = camera.center.copy();

        if (oldPos.equals(newPos)) return;

        this.player.x = newPos.x;
        this.player.y = newPos.y;

        const path = newPos.sub(oldPos);
        const desiredRot = Math.degrees(path.angle());
        this.player.desiredRotation = desiredRot;

        this.player.updateRotation();
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        this.player.draw(parameters);
    }
}
