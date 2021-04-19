import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { BaseItem } from "../base_item";
import { enumColorMixingResults, enumColors, enumColorsToHexCode } from "../colors";
import { WirelessDisplayComponent } from "../components/wireless_display";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON, isTrueItem } from "../items/boolean_item";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "../items/color_item";
import { MapChunkView } from "../map_chunk_view";
import { THIRDPARTY_URLS } from "../../core/config";
import { DialogWithForm } from "../../core/modal_dialog_elements";
import { FormElementInput } from "../../core/modal_dialog_forms";
import { fillInLinkIntoTranslation } from "../../core/utils";
import { T } from "../../translations";
import { Entity } from "../entity";
import { THEME } from "../theme";
import { enumDirectionToAngle, Vector } from "../../core/vector";

/** @type {Object<ItemType, number>} */
const enumTypeToSize = {
    boolean: 9,
    shape: 9,
    color: 14,
};

export class WirelessDisplaySystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [WirelessDisplayComponent]);

        this.root.signals.entityManuallyPlaced.add(this.channelSignalValue, this);

        this.root.signals.entityQueuedForDestroy.add(this.refreshWirelessMachineList, this);
        this.root.signals.entityAdded.add(this.refreshWirelessMachineList, this);
        this.root.signals.entityDestroyed.add(this.refreshWirelessMachineList, this);

        // /** @type {Object<string, import("../../core/draw_utils").AtlasSprite>} */
        // this.displaySprites = {};

        // for (const colorId in enumColors) {
        //     if (colorId === enumColors.uncolored) {
        //         continue;
        //     }
        //     this.displaySprites[colorId] = Loader.getSprite("sprites/wires/display/" + colorId + ".png");
        // }

        /** @type {Object<string, Array<Entity>>} */
        this.wirelessMachineList = {};
    }

    refreshWirelessMachineList() {
        this.wirelessMachineList = {};
        for (let i = 0; i < this.allEntities.length; i++) {
            const entity = this.allEntities[i];
            if (entity.components.WiredPins) {
                const code = entity.components.WirelessCode.wireless_code;
                if (!this.wirelessMachineList[code]) {
                    this.wirelessMachineList[code] = [];
                }

                this.wirelessMachineList[code].push(entity);
            }
        }
    }

    /**
     * Asks the entity to enter a valid signal code
     * @param {Entity} entity
     */
    channelSignalValue(entity) {
        if (!entity.components.WirelessDisplay) {
            return;
        }

        // Ok, query, but also save the uid because it could get stale
        const uid = entity.uid;

        const signalValueInput = new FormElementInput({
            id: "channelValue",
            label: fillInLinkIntoTranslation(T.dialogs.editChannel.descShortKey, THIRDPARTY_URLS.shapeViewer),
            placeholder: "",
            defaultValue: "",
            validator: val => val,
        });

        const channeldialog = new DialogWithForm({
            app: this.root.app,
            title: T.dialogs.editChannel.title,
            desc: T.dialogs.editChannel.descItems,
            formElements: [signalValueInput],
            buttons: ["cancel:bad:escape", "ok:good:enter"],
            closeButton: false,
        });
        this.root.hud.parts.dialogs.internalShowDialog(channeldialog);

        // When confirmed, set the signal
        const closeHandler = () => {
            if (!this.root || !this.root.entityMgr) {
                // Game got stopped
                return;
            }

            const entityRef = this.root.entityMgr.findByUid(uid, false);
            if (!entityRef) {
                // outdated
                return;
            }

            const constantComp = entityRef.components.WirelessCode;
            if (!constantComp) {
                // no longer interesting
                return;
            }

            if (signalValueInput.getValue()) {
                entity.components.WirelessCode.wireless_code = signalValueInput.getValue();
            }
        };

        channeldialog.buttonSignals.ok.add(closeHandler);
        channeldialog.valueChosen.add(closeHandler);

        // When cancelled, destroy the entity again
        channeldialog.buttonSignals.cancel.add(() => {
            if (!this.root || !this.root.entityMgr) {
                // Game got stopped
                return;
            }

            const entityRef = this.root.entityMgr.findByUid(uid, false);
            if (!entityRef) {
                // outdated
                return;
            }

            const constantComp = entityRef.components.WirelessCode;
            if (!constantComp) {
                // no longer interesting
                return;
            }

            this.root.logic.tryDeleteBuilding(entityRef);
        });
    }

    /**
     * Returns the color / value a display should show
     * @param {BaseItem} value
     * @returns {BaseItem}
     */
    getDisplayItem(value) {
        if (!value) {
            return null;
        }

        switch (value.getItemType()) {
            case "boolean": {
                return isTrueItem(value) ? COLOR_ITEM_SINGLETONS[enumColors.white] : null;
            }

            case "color": {
                const item = /**@type {ColorItem} */ (value);
                return item.color === enumColors.uncolored ? null : item;
            }

            case "shape": {
                return value;
            }

            default:
                assertAlways(false, "Unknown item type: " + value.getItemType());
        }
    }

    /**
     * Computes the color below the current tile
     * @returns {string}
     */
    computeChannelBelowTile() {
        const mousePosition = this.root.app.mousePosition;
        if (!mousePosition) {
            // Not on screen
            return null;
        }

        const worldPos = this.root.camera.screenToWorld(mousePosition);
        const tile = worldPos.toTileSpace();
        const contents = this.root.map.getTileContent(tile, "regular");

        if (contents && contents.components.WirelessCode) {
            return contents.components.WirelessCode.wireless_code;
        }

        return null;
    }

    /**
     * Draws Text Storked
     * @param {string} text
     * @param {number} y
     * @param {number} x
     */
    drawStroked(ctx, text, x, y) {
        ctx.font = "15px Sans-serif";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = "white";
        ctx.fillText(text, x, y);
    }

    /**
     * @param {Entity} receiver
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     */
    drawBasedOnSender(receiver, parameters) {
        const code = receiver.components.WirelessCode.wireless_code;
        const senders = this.wirelessMachineList[code];

        if (!senders) {
            return;
        }

        // /** @type {Array<Entity>} */
        // const singlePins = [];
        // /** @type {Array<Entity>} */
        // const quadPins = [];
        // for (const sender of senders) {
        //     const pinsComp = sender.components.WiredPins;
        //     if (pinsComp.slots.length == 1) {
        //         singlePins.push(sender);
        //     } else {
        //         quadPins.push(sender);
        //     }
        // }

        /** @type {Array<Array<BaseItem>, Array<BaseItem>, Array<BaseItem>, Array<BaseItem>>} */
        const corners = [[], [], [], []];
        for (const sender of senders) {
            const pinsComp = sender.components.WiredPins;
            const slots = pinsComp.slots;
            for (let i = 0; i < slots.length; i++) {
                const network = slots[i].linkedNetwork;

                if (!network) {
                    continue;
                }

                const value = this.getDisplayItem(network.currentValue);

                if (value) {
                    corners[i].push(value);
                    if (slots.length === 1) {
                        corners[1].push(value);
                        corners[2].push(value);
                        corners[3].push(value);
                    }
                }
            }
        }

        const possibleItems = [];
        for (const corner of corners) {
            let shape = null;
            let color = null;
            for (const value of corner) {
                if (!value) {
                    continue;
                }

                if (value.getItemType() === "color") {
                    if (!color) {
                        color = value.getAsCopyableKey();
                        continue;
                    }

                    color = enumColorMixingResults[color][value.getAsCopyableKey()];
                } else if (value.getItemType() === "shape") {
                    shape = value.getAsCopyableKey();
                }
            }

            if (shape) {
                shape = this.root.shapeDefinitionMgr.getShapeItemFromShortKey(shape);
                possibleItems.push(shape);
            } else if (color) {
                possibleItems.push(COLOR_ITEM_SINGLETONS[color]);
            } else {
                possibleItems.push(null);
            }
        }

        const ctx = parameters.context;
        const origin = receiver.components.StaticMapEntity.origin;
        // if (singlePins.length == senders.length) {
        //     if (shape) {
        //         shape = this.root.shapeDefinitionMgr.getShapeItemFromShortKey(shape);
        //         let radius = 30;
        //         // @ts-ignore
        //         if (parameters.root.app.settings.getAllSettings().visibleDisplayMod) {
        //             radius += 11;
        //         }
        //         shape.drawItemCenteredClipped(
        //             (origin.x + 0.5) * globalConfig.tileSize,
        //             (origin.y + 0.5) * globalConfig.tileSize,
        //             parameters,
        //             radius
        //         );
        //     } else if (color) {
        //         ctx.fillStyle = enumColorsToHexCode[color];
        //         ctx.fillRect(
        //             (origin.x + 0.5) * globalConfig.tileSize - globalConfig.tileSize / 2 + 1,
        //             (origin.y + 0.5) * globalConfig.tileSize - globalConfig.tileSize / 2 + 1,
        //             globalConfig.tileSize - 2,
        //             globalConfig.tileSize - 2
        //         );
        //     }
        // } else if (quadPins.length == senders.length) {
        ctx.fillStyle = "black";
        ctx.fillRect(
            (origin.x + 0.5) * globalConfig.tileSize - 16,
            (origin.y + 0.5) * globalConfig.tileSize - 15.5,
            32.25,
            32.25
        );

        // console.log(possibleItems);
        for (let index = 0; index < possibleItems.length; ++index) {
            const value = possibleItems[index];

            const dims = globalConfig.tileSize;
            let currentX = origin.x * dims;
            let currentY = origin.y * dims;

            if (value) {
                switch (index) {
                    case 0:
                        // currentX += 0.25;
                        // currentY += 0.5;
                        break;
                    case 1:
                        currentX += dims / 2;
                        currentY += 0.2;
                        // currentX += dims / 2 - 0.25;
                        // currentY += 0.5;
                        break;
                    case 2:
                        currentX += dims / 2;
                        currentY += dims / 2 + 0.1;
                        // currentX += dims / 2 + 0.25;
                        // currentY += dims / 2 + 0.5;
                        break;
                    case 3:
                        currentY += dims / 2 + 0.25;
                        // currentX += 0.25;
                        // currentY += dims / 2 + 0.5;
                        break;
                    default:
                        break;
                }

                if (value.getItemType() === "color") {
                    ctx.fillStyle = enumColorsToHexCode[value.getAsCopyableKey()];
                    ctx.fillRect(currentX, currentY, dims / 2, dims / 2);
                } else if (value.getItemType() === "shape") {
                    value.drawItemCenteredClipped(
                        currentX + dims / 4 + 0.25,
                        currentY + dims / 4 + 0.25,
                        parameters,
                        20
                    );
                }
            }
        }
    }

    /**
     * Draws corner items on wire layer
     */
    drawCorners(entity, parameters, chunk) {
        const pinsComp = entity.components.WiredPins;
        const staticComp = entity.components.StaticMapEntity;
        const slots = pinsComp.slots;

        for (let i = 0; i < slots.length; ++i) {
            const slot = slots[i];
            const tile = staticComp.localTileToWorld(slot.pos);
            const network = slot.linkedNetwork;

            if (!network) {
                continue;
            }

            if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) {
                // Doesn't belong to this chunk
                continue;
            }
            const worldPos = tile.toWorldSpaceCenterOfTile();

            const effectiveRotation = Math.radians(enumDirectionToAngle[slot.direction] - 90);

            // Draw contained item to visualize whats emitted
            const value = network.currentValue;
            if (value) {
                const offset = new Vector(10.65, -10.5).rotated(effectiveRotation);
                value.drawItemCenteredClipped(
                    worldPos.x + offset.x,
                    worldPos.y + offset.y,
                    parameters,
                    enumTypeToSize[value.getItemType()]
                );
            }
        }
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawRegularChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.WirelessCode) {
                if (!entity.components.WiredPins) {
                    this.drawBasedOnSender(entity, parameters);
                }
            }
            const below = this.computeChannelBelowTile();
            if (below) {
                // We have something below our tile
                const mousePosition = this.root.app.mousePosition;
                const worldPos = this.root.camera.screenToWorld(mousePosition);
                const tile = worldPos.toTileSpace().toWorldSpace();

                this.drawStroked(parameters.context, below.toString(), worldPos.x + 5, worldPos.y + 5);
                parameters.context.strokeStyle = THEME.map.colorBlindPickerTile;
                parameters.context.beginPath();
                parameters.context.rect(tile.x, tile.y, globalConfig.tileSize, globalConfig.tileSize);
                parameters.context.stroke();
            }
        }
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawWiresChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.WirelessCode) {
                if (!entity.components.WiredPins) {
                    this.drawBasedOnSender(entity, parameters);
                }
            }
            if (entity.components.QuadSender) {
                const quadSenderWire = Loader.getSprite(
                    "sprites/buildings/wireless_buildings-quad_sender(wire).png"
                );
                const staticEntity = entity.components.StaticMapEntity;
                const origin = staticEntity.origin;
                const tileSize = globalConfig.tileSize;
                quadSenderWire.drawCachedCentered(
                    parameters,
                    origin.x * tileSize + tileSize / 2,
                    origin.y * tileSize + tileSize / 2,
                    tileSize
                );

                this.drawCorners(entity, parameters, chunk);
            }
            const below = this.computeChannelBelowTile();
            if (below) {
                // We have something below our tile
                const mousePosition = this.root.app.mousePosition;
                const worldPos = this.root.camera.screenToWorld(mousePosition);
                const tile = worldPos.toTileSpace().toWorldSpace();

                this.drawStroked(parameters.context, below.toString(), worldPos.x + 5, worldPos.y + 5);
                parameters.context.strokeStyle = THEME.map.colorBlindPickerTile;
                parameters.context.beginPath();
                parameters.context.rect(tile.x, tile.y, globalConfig.tileSize, globalConfig.tileSize);
                parameters.context.stroke();
            }
        }
    }

    /**
     * Draws overlay of a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunkOverlay(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.WirelessCode) {
                if (!entity.components.WiredPins) {
                    this.drawBasedOnSender(entity, parameters);
                }
            }

            const below = this.computeChannelBelowTile();
            if (below) {
                // We have something below our tile
                const mousePosition = this.root.app.mousePosition;
                const worldPos = this.root.camera.screenToWorld(mousePosition);
                const tile = worldPos.toTileSpace().toWorldSpace();

                this.drawStroked(parameters.context, below.toString(), worldPos.x + 5, worldPos.y + 5);
                parameters.context.strokeStyle = THEME.map.colorBlindPickerTile;
                parameters.context.beginPath();
                parameters.context.rect(tile.x, tile.y, globalConfig.tileSize, globalConfig.tileSize);
                parameters.context.stroke();
            }
        }
    }
}
