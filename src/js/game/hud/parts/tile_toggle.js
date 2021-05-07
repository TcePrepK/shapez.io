import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { enumMouseButton } from "../../camera";
import { isBombItem, NumberItem } from "../../items/number_item";
import { itemResolverSingleton } from "../../item_resolver";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

export class HUDTileToggle extends BaseHUDPart {
    constructor(root) {
        super(root);

        this.root.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        window.addEventListener("dblclick", this.onMouseDoubleClick.bind(this));

        /** @type Array<{
         *   x: number,
         *   y: number
         * }> */
        this.markedList = [];

        this.firstShot = true;

        this.score = 0;
    }

    /**
     * Should create all require elements
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_Scoreboard", [], `<h2>CURRENT SCORE: ${this.score} </h2>`);
    }

    initialize() {}

    update() {
        this.handleMarkeds();
    }

    onMouseDown(event) {
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

    onMouseUp() {
        this.mouseIsDown = false;
    }

    onMouseDoubleClick(event) {
        if (this.root.camera.getIsMapOverlayActive() || event.button === 1 || event.button === 2) {
            return;
        }

        const pos = new Vector(event.clientX, event.clientY);
        const tile = this.root.camera.screenToWorld(pos).toTileSpace();
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

        if (item.blocked) {
            return;
        }

        this.handleToggleNeighbors(tile);
    }

    /**
     * @param {Vector} tile
     * @param {enumMouseButton} button
     * @param {boolean} manual
     */
    handleTileToggle(tile, button, manual = false) {
        const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

        if (button === enumMouseButton.left) {
            if (item.flagged) {
                return;
            }

            this.markedList.push(tile.serializeSimple());
        } else if (button === enumMouseButton.right && item.blocked) {
            item.flagged = !item.flagged;
        }
    }

    /**
     * @param {Vector} tile
     */
    handleToggleNeighbors(tile) {
        for (let x = -1; x < 2; x++) {
            for (let y = -1; y < 2; y++) {
                if (x === 0 && y === 0) {
                    continue;
                }

                this.markedList.push(tile.addScalars(x, y).serializeSimple());
            }
        }
    }

    handleMarkeds() {
        /** @type {Array<Object<String, Number>>} */
        const nextMarkedList = [];
        while (this.markedList.length > 0) {
            const tile = this.markedList.shift();

            const item = this.root.map.getLowerLayerContentXY(tile.x, tile.y);

            if (!item.blocked || item.flagged) {
                continue;
            }

            item.blocked = false;
            this.score += 0.5;

            if (isBombItem(item)) {
                if (!this.firstShot) {
                    this.score = 0;
                    this.root.gameOver = true;
                    this.element.innerHTML = `<h2>GAME OVER</h2>`;
                    continue;
                }
            }

            this.element.innerHTML = `<h2>CURRENT SCORE: ${Math.floor(this.score)} </h2>`;
            this.firstShot = false;

            if (this.calculateValueOfTile(new Vector(tile.x, tile.y)) === 0) {
                for (let x = -1; x < 2; x++) {
                    for (let y = -1; y < 2; y++) {
                        if (x === 0 && y === 0) {
                            continue;
                        }

                        const newTile = { x: tile.x + x, y: tile.y + y };
                        if (this.markedList.indexOf(newTile) != -1) {
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
