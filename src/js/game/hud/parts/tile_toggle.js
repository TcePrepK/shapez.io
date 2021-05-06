import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { isBombItem, NumberItem } from "../../items/number_item";
import { BaseHUDPart } from "../base_hud_part";

export class HUDTileToggle extends BaseHUDPart {
    initialize() {
        // this.root.camera.downPreHandler.add(this.mouseDown, this);
        // this.root.mo.add(this.mouseUp, this);

        this.root.canvas.addEventListener("mousedown", this.mouseDown.bind(this));
        window.addEventListener("mouseup", this.mouseUp.bind(this));

        /** @type {Array<Object<String, Number>>} */
        this.markedList = [];

        this.firstShot = true;
    }

    update() {
        this.handleMarkeds();
    }

    mouseDown(event) {
        if (this.root.camera.getIsMapOverlayActive() || event.button === 1) {
            return;
        }

        const pos = new Vector(event.clientX, event.clientY);
        const tile = this.root.camera.screenToWorld(pos).toTileSpace();

        if (event.button === 2) {
            this.handleTileToggle(tile, enumMouseButton.right, true);
            return;
        }

        this.mouseIsDown = true;
        var hud = this;
        var holdingMouse = false;

        const delay = 100;
        setTimeout(
            function () {
                if (hud.mouseIsDown) {
                    holdingMouse = true;
                }
            }.bind(this.mouseIsDown),
            delay
        );

        setTimeout(function () {
            if (holdingMouse) {
                return;
            }

            hud.handleTileToggle(tile, enumMouseButton.left, true);
        }, delay);
    }

    mouseUp() {
        this.mouseIsDown = false;
    }

    /**
     * @param {Vector} tile
     * @param {enumMouseButton} button
     * @param {boolean} manual
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

            for (let x = -1; x < 2; x++) {
                for (let y = -1; y < 2; y++) {
                    if (x === 0 && y === 0) {
                        continue;
                    }

                    this.handleTileToggle(tile.addScalars(x, y), button);
                }
            }
            return;
        }

        if (button === enumMouseButton.left) {
            if (lowerLayer.flagged) {
                return;
            }

            this.markedList.push(tile.serializeSimple());
        } else if (button === enumMouseButton.right) {
            lowerLayer.flagged = !lowerLayer.flagged;
        }
    }

    handleMarkeds() {
        console.log(this.markedList);
        /** @type {Array<Vector>} */
        const nextMarkedList = [];
        for (const tile of this.markedList) {
            this.markedList.shift();

            const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
            if (isBombItem(item)) {
                if (!this.firstShot) {
                    this.root.gameOver = true;
                    continue;
                }
            }

            this.firstShot = false;
            item.blocked = false;

            if (this.calculateValueOfTile(tile) === 0) {
                for (let x = -1; x < 2; x++) {
                    for (let y = -1; y < 2; y++) {
                        if (x === 0 && y === 0) {
                            continue;
                        }

                        const newTile = tile.addScalars(x, y);
                        if (this.markedList.indexOf(newTile.serializeSimple()) != -1) {
                            continue;
                        }

                        nextMarkedList.push(newTile);
                    }
                }
            }
        }
        this.markedList = nextMarkedList;
    }

    /**
     * @param {Vector} tile
     */
    calculateValueOfTile(tile) {
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);
        let endResult = 0;
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                const neighbor = this.root.map.getLowerLayerContentXY(tile.x + i, tile.y + j);
                if (isBombItem(neighbor)) {
                    endResult++;
                }
            }
        }
        if (isBombItem(item)) {
            endResult -= 1;
        }

        item.value = endResult;
        return endResult;
    }
}
