import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { BaseItem } from "../base_item";
import { enumColors } from "../colors";
import { WirelessDisplayComponent } from "../components/wireless_display";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON, isTrueItem } from "../items/boolean_item";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "../items/color_item";
import { MapChunkView } from "../map_chunk_view";
import { THIRDPARTY_URLS } from "../../core/config";
import { DialogWithForm } from "../../core/modal_dialog_elements";
import { FormElementInput, FormElementItemChooser } from "../../core/modal_dialog_forms";
import { fillInLinkIntoTranslation } from "../../core/utils";
import { T } from "../../translations";
import { Entity } from "../entity";
import { THEME } from "../theme";
import { drawRotatedSprite } from "../../core/draw_utils";
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

        /** @type {Object<string, import("../../core/draw_utils").AtlasSprite>} */
        this.displaySprites = {};

        for (const colorId in enumColors) {
            if (colorId === enumColors.uncolored) {
                continue;
            }
            this.displaySprites[colorId] = Loader.getSprite("sprites/wires/display/" + colorId + ".png");
        }

        this.wirelessMachineList = {};
    }

    update() {
        this.wirelessMachineList = {};
        for (let i = 0; i < this.allEntities.length; i++) {
            const entity = this.allEntities[i];
            if (entity.components.WiredPins) {
                this.wirelessMachineList[entity.components.WirelessCode.wireless_code] = entity;
            }
        }
    }

    testVal(val, entity) {
        console.log(entity.components);
        return true;
    }

    /**
     * Asks the entity to enter a valid signal code
     * @param {Entity} entity
     */
    channelSignalValue(entity) {
        if (entity.components.WirelessDisplay) {
            // Ok, query, but also save the uid because it could get stale
            const uid = entity.uid;

            const signalValueInput = new FormElementInput({
                id: "channelValue",
                label: fillInLinkIntoTranslation(
                    T.dialogs.editChannel.descShortKey,
                    THIRDPARTY_URLS.shapeViewer
                ),
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

                if (signalValueInput.getValue() && entity.components.WiredPins) {
                    this.wirelessMachineList[entity.components.WirelessCode.wireless_code] = entity;
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
        const sender = this.wirelessMachineList[receiver.components.WirelessCode.wireless_code];

        if (sender) {
            if (!this.allEntities.includes(sender)) {
                delete this.wirelessMachineList.entity_b;
                return;
            }
            const origin = receiver.components.StaticMapEntity.origin;
            const pinsComp = sender.components.WiredPins;

            if (pinsComp.slots.length == 1) {
                const network = pinsComp.slots[0].linkedNetwork;

                if (!network) {
                    return;
                }

                const value = this.getDisplayItem(network.currentValue);

                if (!value) {
                    return;
                }

                if (value.getItemType()) {
                    if (value.getItemType() === "color") {
                        this.displaySprites[/** @type {ColorItem} */ (value).color].drawCachedCentered(
                            parameters,
                            (origin.x + 0.5) * globalConfig.tileSize,
                            (origin.y + 0.5) * globalConfig.tileSize,
                            globalConfig.tileSize
                        );
                    } else if (value.getItemType() === "shape") {
                        let radius = 30;
                        // @ts-ignore
                        if (parameters.root.app.settings.getAllSettings().visibleDisplayMod) {
                            radius += 11;
                        }
                        value.drawItemCenteredClipped(
                            (origin.x + 0.5) * globalConfig.tileSize,
                            (origin.y + 0.5) * globalConfig.tileSize,
                            parameters,
                            radius
                        );
                    }
                }
            } else if (pinsComp.slots.length == 4) {
                const possibleItems = [];
                for (let slot = 0; slot < pinsComp.slots.length; ++slot) {
                    const network = pinsComp.slots[slot].linkedNetwork;

                    if (!network) {
                        possibleItems.push("dead");
                        continue;
                    }

                    if (network.currentValue == null) {
                        possibleItems.push("dead");
                        continue;
                    }

                    if (network.currentValue == BOOL_FALSE_SINGLETON) {
                        possibleItems.push("dead");
                        continue;
                    }

                    const value = this.getDisplayItem(network.currentValue);

                    if (value) {
                        possibleItems.push(value);
                    }
                }

                if (possibleItems.length > 0) {
                    const D_context = parameters.context;
                    D_context.fillStyle = "black";
                    D_context.fillRect(
                        (origin.x + 0.5) * globalConfig.tileSize - 16,
                        (origin.y + 0.5) * globalConfig.tileSize - 15.5,
                        32.25,
                        32.25
                    );
                }

                for (let index = 0; index < possibleItems.length; ++index) {
                    const value = possibleItems[index];

                    let currentX = (origin.x + 0.5) * globalConfig.tileSize;
                    let currentY = (origin.y + 0.5) * globalConfig.tileSize;
                    let drawSize = globalConfig.tileSize / 2 + 1;

                    if (value) {
                        switch (index) {
                            case 0:
                                currentX -= globalConfig.tileSize / 4 - 0.25;
                                currentY -= globalConfig.tileSize / 4 - 0.5;
                                break;
                            case 1:
                                currentX -= globalConfig.tileSize / 4 - globalConfig.tileSize / 2 - 0.25;
                                currentY -= globalConfig.tileSize / 4 - 0.5;
                                break;
                            case 2:
                                currentX -= globalConfig.tileSize / 4 - globalConfig.tileSize / 2 - 0.25;
                                currentY -= globalConfig.tileSize / 4 - globalConfig.tileSize / 2 - 0.5;
                                break;
                            case 3:
                                currentX -= globalConfig.tileSize / 4 - 0.25;
                                currentY -= globalConfig.tileSize / 4 - globalConfig.tileSize / 2 - 0.5;
                                break;
                            default:
                                break;
                        }

                        if (typeof value == "string") {
                            continue;
                        } else if (value.getItemType() === "color") {
                            this.displaySprites[/** @type {ColorItem} */ (value).color].drawCachedCentered(
                                parameters,
                                currentX,
                                currentY,
                                drawSize
                            );
                        } else if (value.getItemType() === "shape") {
                            let radius = 20;
                            value.drawItemCenteredClipped(currentX, currentY, parameters, radius);
                        }
                    }
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

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawSignalChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.WirelessCode) {
                const sender = this.wirelessMachineList[entity.components.WirelessCode.wireless_code];

                if (sender) {
                    const origin = entity.components.StaticMapEntity.origin;
                    const senderOrigin = sender.components.StaticMapEntity.origin;

                    const tileSize = globalConfig.tileSize;

                    const ctx = parameters.context;

                    ctx.beginPath();
                    ctx.strokeStyle = "blue";
                    ctx.lineWidth = 1;
                    ctx.miterLimit = 2;
                    ctx.moveTo(origin.x * tileSize + tileSize / 2, origin.y * tileSize + tileSize / 2);
                    ctx.lineTo(
                        senderOrigin.x * tileSize + tileSize / 2,
                        senderOrigin.y * tileSize + tileSize / 2
                    );
                    ctx.stroke();
                }
            }
        }
    }
}
