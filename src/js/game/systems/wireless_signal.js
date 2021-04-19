import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";
import { BaseItem } from "../base_item";
import { enumColors } from "../colors";
import { WirelessDisplayComponent } from "../components/wireless_display";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { isTrueItem } from "../items/boolean_item";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "../items/color_item";
import { MapChunkView } from "../map_chunk_view";
import { THIRDPARTY_URLS } from "../../core/config";
import { DialogWithForm } from "../../core/modal_dialog_elements";
import { FormElementInput, FormElementItemChooser } from "../../core/modal_dialog_forms";
import { fillInLinkIntoTranslation } from "../../core/utils";
import { T } from "../../translations";
import { Entity } from "../entity";
import { THEME } from "../theme";
import { WirelessSignalComponent } from "../components/wireless_signal";
import { enumDirectionToAngle, Vector } from "../../core/vector";
import { drawRotatedSprite } from "../../core/draw_utils";
import { DrawParameters } from "../../core/draw_parameters";

/** @type {Object<ItemType, number>} */
const enumTypeToSize = {
    boolean: 9,
    shape: 9,
    color: 14,
};

export class WirelessSignalSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [WirelessSignalComponent]);

        this.root.signals.entityManuallyPlaced.add(this.channelSignalValue, this);
    }

    update() {
        // Reset All List
        this.wirelessInputList = {};
        this.wirelessOutputList = {};
        for (let i = 0; i < this.allEntities.length; i++) {
            const entity = this.allEntities[i];

            if (!entity.components.WirelessCode) {
                continue;
            }

            const wirelessCode = entity.components.WirelessCode.wireless_code;
            const parts = wirelessCode.split("/");

            // Define List Again

            if (!this.wirelessInputList[parts[0]]) {
                this.wirelessInputList[parts[0]] = [];
            }
            if (!this.wirelessOutputList[parts[1]]) {
                this.wirelessOutputList[parts[1]] = [];
            }

            this.wirelessInputList[parts[0]].push(entity);
            this.wirelessOutputList[parts[1]].push(entity);

            const pinsComp = entity.components.WiredPins;
            const network = pinsComp.slots[0].linkedNetwork;

            if (network) {
                network.currentValue == null;
            }
        }

        for (const code in this.wirelessInputList) {
            const senderEntities = this.wirelessInputList[code];

            for (let i = 0; i < senderEntities.length; ++i) {
                const senderEntity = senderEntities[i];

                const pinsComp = senderEntity.components.WiredPins;
                const input_network = pinsComp.slots[1].linkedNetwork;
                const outputCode = senderEntity.components.WirelessCode.wireless_code.split("/")[0];
                const receiverEntities = this.wirelessOutputList[outputCode];

                if (!input_network) {
                    continue;
                }

                if (!receiverEntities) {
                    continue;
                }

                for (let j = 0; j < receiverEntities.length; ++j) {
                    const receiverEntity = receiverEntities[j];

                    // Set Outputs

                    const receiverOutput = receiverEntity.components.WiredPins.slots[0];
                    if (input_network) {
                        receiverOutput.value = input_network.currentValue;
                    }
                }
            }
        }

        for (const code in this.wirelessOutputList) {
            const inputEntities = this.wirelessInputList[code];
            let nullInputs = 0;

            if (!inputEntities) {
                continue;
            }

            for (let i = 0; i < inputEntities.length; ++i) {
                const entity = inputEntities[i];
                const pinsComp = entity.components.WiredPins;
                const input_network = pinsComp.slots[1].linkedNetwork;

                if (!input_network) {
                    nullInputs++;
                    continue;
                }
            }
            if (nullInputs === inputEntities.length) {
                const entities = this.wirelessOutputList[code];
                for (let i = 0; i < entities.length; ++i) {
                    const entity = entities[i];
                    const output = entity.components.WiredPins.slots[0];
                    output.value = null;
                }
            }
        }
    }

    testVal(val) {
        const parts = val.split("/");
        if (parts.length != 2) {
            return false;
        }

        if (parts[0] == "" || parts[1] == "") {
            return false;
        }

        return true;
    }

    /**
     * Asks the entity to enter a valid signal code
     * @param {Entity} entity
     */
    channelSignalValue(entity) {
        if (entity.components.WirelessSignal) {
            // Ok, query, but also save the uid because it could get stale
            const uid = entity.uid;
            const signalValueInput = new FormElementInput({
                id: "channelValue",
                // eslint-disable-next-line prettier/prettier
                label: fillInLinkIntoTranslation(
                    T.dialogs.editChannelForWS.descShortKey,
                    THIRDPARTY_URLS.shapeViewer
                ),
                placeholder: "",
                defaultValue: "",
                validator: val => this.testVal(val),
            });

            const channeldialog = new DialogWithForm({
                app: this.root.app,
                title: T.dialogs.editChannelForWS.title,
                desc: T.dialogs.editChannelForWS.descItems,
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
        const contents = this.root.map.getTileContent(tile, "wires");

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
     * @param {number=} width
     */
    drawStroked(ctx, text, x, y, width = undefined) {
        ctx.font = "15px Sans-serif";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y, width);
        ctx.fillStyle = "white";
        ctx.fillText(text, x, y, width);
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawWiresChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.wires;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.WirelessSignal) {
                const staticComp = entity.components.StaticMapEntity;
                const slot = entity.components.WiredPins.slots[0];
                const tile = staticComp.localTileToWorld(slot.pos);
                const worldPos = tile.toWorldSpaceCenterOfTile();
                const effectiveRotation = Math.radians(
                    staticComp.rotation + enumDirectionToAngle[slot.direction]
                );

                if (!chunk.tileSpaceRectangle.containsPoint(tile.x, tile.y)) {
                    // Doesn't belong to this chunk
                    continue;
                }

                // Draw contained item to visualize whats emitted
                const value = slot.value;
                if (value) {
                    const offset = new Vector(0, 0).rotated(effectiveRotation);

                    value.drawItemCenteredClipped(
                        worldPos.x + offset.x,
                        worldPos.y + offset.y,
                        parameters,
                        enumTypeToSize[value.getItemType()]
                    );
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
}
