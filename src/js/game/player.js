import { Root } from "postcss";
import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { Vector } from "../core/vector";
import { Camera } from "./camera";

export class Player {
    /**
     * @param {Camera} camera
     */
    constructor(camera) {
        this.camera = camera;

        this.root = camera.root;

        this.reachLen = 10;
        this.outOfReach = 0;
    }

    /**
     * @param {DrawParameters} parameters
     */
    drawPlayer(parameters) {
        const ctx = parameters.context;
        const pos = this.camera.center.copy();
        const width = this.root.app.screenWidth;
        const height = this.root.app.screenHeight;
        const mousePosition = this.root.app.mousePosition.copy();
        const diff = mousePosition.sub(new Vector(width / 2, height / 2));
        const angle = Math.atan2(diff.x, diff.y);
        const w = globalConfig.tileSize;

        ctx.translate(pos.x, pos.y);
        ctx.rotate(-angle);

        ctx.fillStyle = "red";
        ctx.fillRect(-w / 2, -w / 2, w, w);

        if (this.outOfReach > 0) {
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.arc(0, 0, this.reachLen * globalConfig.tileSize, 0, 2 * Math.PI);
            ctx.stroke();
            this.outOfReach--;
        }

        ctx.rotate(angle);
        ctx.translate(-pos.x, -pos.y);
    }
}
