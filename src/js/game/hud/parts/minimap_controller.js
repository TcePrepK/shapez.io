import { globalConfig } from "../../../core/config";
import { Rectangle } from "../../../core/rectangle";
import { clamp } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { BaseHUDPart } from "../base_hud_part";

export class HUDMinimapController extends BaseHUDPart {
    initialize() {
        this.root.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
        this.root.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        this.root.canvas.addEventListener("wheel", this.onMouseWheel.bind(this));

        this.onStartUp();
    }

    onStartUp() {
        const scale = globalConfig.minimapScale;
        const width = this.root.gameWidth;
        const height = this.root.gameHeight;

        const rectWidth = (width * 2) / scale;
        const rectHeight = (height * 2) / scale;

        globalConfig.minimapOffsetX = width - rectWidth;
        globalConfig.minimapOffsetY = height - rectHeight;

        this.startMoving = false;
        this.minimapHoldingOffset = new Vector();
    }

    onMouseDown() {
        const mouse = globalConfig.app.mousePosition;
        const scale = globalConfig.minimapScale;
        const width = this.root.gameWidth;
        const height = this.root.gameHeight;
        const rectWidth = (width * 2) / scale;
        const rectHeight = (height * 2) / scale;

        const offset = new Vector(globalConfig.minimapOffsetX, globalConfig.minimapOffsetY);
        const rectangle = new Rectangle(offset.x, offset.y, rectWidth, rectHeight);

        if (rectangle.containsPoint(mouse.x, mouse.y)) {
            globalConfig.movingMinimap = true;
            this.minimapHoldingOffset = new Vector(mouse.x - offset.x, mouse.y - offset.y);
        }
    }

    onMouseMove() {
        if (globalConfig.movingMinimap) {
            const mouse = globalConfig.app.mousePosition;
            const scale = globalConfig.minimapScale;
            const width = this.root.gameWidth;
            const height = this.root.gameHeight;
            const rectWidth = (width * 2) / scale;
            const rectHeight = (height * 2) / scale;

            const fixedPos = mouse.sub(this.minimapHoldingOffset);

            globalConfig.minimapOffsetX = clamp(fixedPos.x, 0, width - rectWidth);
            globalConfig.minimapOffsetY = clamp(fixedPos.y, 0, height - rectHeight);
        }
    }

    onMouseUp() {
        globalConfig.movingMinimap = false;
    }

    /**
     * Mousewheel event
     * @param {WheelEvent} event
     */
    onMouseWheel(event) {
        if (event.cancelable) {
            event.preventDefault();
        }

        const oldScale = globalConfig.minimapScale;
        const width = this.root.gameWidth;
        const height = this.root.gameHeight;
        const oldRectWidth = (width * 2) / oldScale;
        const oldRectHeight = (height * 2) / oldScale;

        const scaleAmount = 1 + 0.15 * this.root.app.settings.getScrollWheelSensitivity();
        let newScale = globalConfig.minimapScale * (event.deltaY < 0 ? 1 / scaleAmount : scaleAmount);
        newScale = clamp(newScale, 4, 20);

        if (newScale != oldScale) {
            const newRectWidth = (width * 2) / newScale;
            const newRectHeight = (height * 2) / newScale;

            const widthDiff = newRectWidth - oldRectWidth;
            const heightDiff = newRectHeight - oldRectHeight;

            globalConfig.minimapOffsetX -= widthDiff / 2;
            globalConfig.minimapOffsetY -= heightDiff / 2;
            globalConfig.minimapScale = newScale;

            const offsetX = globalConfig.minimapOffsetX;
            const offsetY = globalConfig.minimapOffsetY;
            globalConfig.minimapOffsetX = clamp(offsetX, 0, width - newRectWidth);
            globalConfig.minimapOffsetY = clamp(offsetY, 0, height - newRectHeight);
        }
    }
}
