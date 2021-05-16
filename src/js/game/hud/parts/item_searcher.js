import trim from "trim";
import { globalConfig } from "../../../core/config";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementInput, FormElementItemChooser } from "../../../core/modal_dialog_forms";
import { makeDiv } from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { BaseItem } from "../../base_item";
import { enumColors } from "../../colors";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "../../items/color_item";
import { ShapeItem } from "../../items/shape_item";
import { enumSubShape, ShapeDefinition } from "../../shape_definition";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";

const availableColors = [enumColors.red, enumColors.green, enumColors.blue];

export class HUDItemSearcher extends BaseHUDPart {
    constructor(root) {
        super(root);

        /**
         * @type {Array<Vector>}
         */
        this.searchList = [];

        /**
         * @type {Number}
         */
        this.maxSearchPerTick = 5;

        /**
         * @type {Number}
         */
        this.radius = 0;

        /**
         * @type {Number}
         */
        this.searchingAmount = 0;

        /**
         * @type {Number}
         */
        this.foundAmount = 0;

        /**
         * @type {BaseItem}
         */
        this.searchingItem = null;
    }

    /**
     * Should create all require elements
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        this.element = makeDiv(parent, "ingame_HUD_ItemSearcher", [], "<h2>Search Item</h2>");
    }

    initialize() {
        this.trackClicks(this.element, () => this.openItemSelector());
    }

    openItemSelector() {
        const predefinedItems = new FormElementItemChooser({
            id: "predefinedItems",
            label: "Enter or select item short key",
            items: [
                COLOR_ITEM_SINGLETONS[enumColors.red],
                COLOR_ITEM_SINGLETONS[enumColors.green],
                COLOR_ITEM_SINGLETONS[enumColors.blue],
                this.root.shapeDefinitionMgr.getShapeItemFromShortKey("CuCuCuCu"),
                this.root.shapeDefinitionMgr.getShapeItemFromShortKey("RuRuRuRu"),
                this.root.shapeDefinitionMgr.getShapeItemFromShortKey("SuSuSuSu"),
                this.root.shapeDefinitionMgr.getShapeItemFromShortKey("RuRuWuWu"),
            ],
        });

        const itemInput = new FormElementInput({
            id: "itemInputValue",
            label: "",
            placeholder: "Insert Shape Code",
            defaultValue: "",
            validator: val => this.parseItem(val),
        });

        const amountInput = new FormElementInput({
            id: "amountInputValue",
            label: "Enter how much of that item you want",
            placeholder: "Insert Number",
            defaultValue: "",
            validator: val => this.parseAmount(val),
        });

        const dialog = new DialogWithForm({
            app: this.root.app,
            title: "Item Searcher",
            desc: "",
            formElements: [predefinedItems, itemInput, amountInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
            closeButton: false,
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        const startSearching = () => {
            this.searchingItem = this.root.shapeDefinitionMgr.getShapeItemFromShortKey(itemInput.getValue());
            this.searchingAmount = parseInt(amountInput.getValue());
        };

        predefinedItems.valueChosen.add(value => {
            itemInput.setValue(value.getAsCopyableKey());
        });

        dialog.buttonSignals.ok.add(startSearching);
    }

    /**
     * Tries to parse a signal code
     * @param {string} code
     * @returns {BaseItem}
     */
    parseString(code) {
        if (!this.root || !this.root.shapeDefinitionMgr) {
            // Stale reference
            return null;
        }

        code = trim(code);
        const codeLower = code.toLowerCase();

        if (enumColors[codeLower]) {
            return COLOR_ITEM_SINGLETONS[codeLower];
        }

        if (ShapeDefinition.isValidShortKey(code)) {
            return this.root.shapeDefinitionMgr.getShapeItemFromShortKey(code);
        }

        return null;
    }

    /**
     * @param {string} value
     * @returns {boolean}
     */
    parseItem(value) {
        const item = this.parseString(value);
        if (!item) return false;
        if (!(item instanceof BaseItem)) return false;
        if (item instanceof ColorItem && availableColors.indexOf(item.getAsCopyableKey()) === -1)
            return false;
        if (item instanceof ShapeItem) {
            const layers = item.definition.layers;
            if (layers.length > 1) return false;
            const corners = layers[0];
            let windmillAmount = 0;
            for (const corner of corners) {
                if (corner.subShape === enumSubShape.windmill) windmillAmount++;
                if (corner.color !== enumColors.uncolored) return false;
            }
            if (windmillAmount > 2) return false;
            if (windmillAmount === 2 && value !== "RuRuWuWu") return false;
        }

        return true;
    }

    /**
     * @returns {boolean}
     */
    parseAmount(value) {
        if (value.includes(".")) return false;
        const number = parseInt(value);
        if (isNaN(value) || isNaN(number)) return false;
        if (number <= 0) return false;

        return true;
    }

    update() {
        const overlay = this.root.camera.getIsMapOverlayActive();
        this.element.classList.toggle("overlay", overlay);

        if (!this.searchingItem) {
            return;
        }

        for (let i = 0; i < this.maxSearchPerTick; ++i) {
            if (this.searchList.length === 0) {
                this.calculateNextSearchList();
                break;
            }

            const vector = this.searchList.shift();
            const chunk = this.root.map.getChunk(vector.x, vector.y, true);
            const patches = chunk.patches;
            for (const patch of patches) {
                if (!patch.item.equals(this.searchingItem)) {
                    continue;
                }

                const pos = patch.pos
                    .addScalars(chunk.tileX, chunk.tileY)
                    .multiplyScalar(globalConfig.tileSize);

                const waypoint = this.root.waypoint.findIntersectedWaypointWithPos(pos);
                if (waypoint) {
                    continue;
                }

                this.root.waypoint.addWaypoint(this.searchingItem.getAsCopyableKey(), pos);
                this.foundAmount++;

                if (this.foundAmount === this.searchingAmount) {
                    this.searchingItem = null;
                    this.foundAmount = 0;
                    return;
                }
            }
        }
    }

    calculateNextSearchList() {
        this.radius++;

        this.searchList.push(new Vector(0, this.radius));
        this.searchList.push(new Vector(0, -this.radius));
        this.searchList.push(new Vector(this.radius, 0));
        this.searchList.push(new Vector(-this.radius, 0));

        for (let x = 1; x < this.radius; x++) {
            this.searchList.push(new Vector(x, -this.radius));
            this.searchList.push(new Vector(x, this.radius));
            this.searchList.push(new Vector(-x, -this.radius));
            this.searchList.push(new Vector(-x, this.radius));
        }

        for (let y = 1; y < this.radius; y++) {
            this.searchList.push(new Vector(-this.radius, y));
            this.searchList.push(new Vector(this.radius, y));
            this.searchList.push(new Vector(-this.radius, -y));
            this.searchList.push(new Vector(this.radius, -y));
        }

        this.searchList.push(new Vector(this.radius, this.radius));
        this.searchList.push(new Vector(this.radius, -this.radius));
        this.searchList.push(new Vector(-this.radius, this.radius));
        this.searchList.push(new Vector(-this.radius, -this.radius));
    }
}
