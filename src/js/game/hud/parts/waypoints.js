import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { globalConfig, THIRDPARTY_URLS } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { gMetaBuildingRegistry } from "../../../core/global_registries";
import { Loader } from "../../../core/loader";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementInput } from "../../../core/modal_dialog_forms";
import { Rectangle } from "../../../core/rectangle";
import { STOP_PROPAGATION } from "../../../core/signal";
import {
    arrayDeleteValue,
    fillInLinkIntoTranslation,
    lerp,
    makeDiv,
    removeAllChildren,
} from "../../../core/utils";
import { Vector } from "../../../core/vector";
import { ACHIEVEMENTS } from "../../../platform/achievement_provider";
import { T } from "../../../translations";
import { BaseItem } from "../../base_item";
import { MetaHubBuilding } from "../../buildings/hub";
import { enumMouseButton } from "../../camera";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { ShapeDefinition } from "../../shape_definition";
import { BaseHUDPart } from "../base_hud_part";
import { DynamicDomAttach } from "../dynamic_dom_attach";
import { enumNotificationType } from "./notifications";

/** @typedef {{
 *   label: string | null,
 *   center: { x: number, y: number },
 *   zoomLevel: number,
 *   layer: Layer,
 * }} Waypoint */

/**
 * Used when a shape icon is rendered instead
 */
const MAX_LABEL_LENGTH = 71;

export class HUDWaypoints extends BaseHUDPart {
    /**
     * Creates the overview of waypoints
     * @param {HTMLElement} parent
     */
    createElements(parent) {
        // Create the helper box on the lower right when zooming out
        if (this.root.app.settings.getAllSettings().offerHints) {
            this.hintElement = makeDiv(
                parent,
                "ingame_HUD_Waypoints_Hint",
                [],
                `
            <strong class='title'>${T.ingame.waypoints.waypoints}</strong>
            <span class='desc'>${T.ingame.waypoints.description.replace(
                "<keybinding>",
                `<code class='keybinding'>${this.root.keyMapper
                    .getBinding(KEYMAPPINGS.navigation.createMarker)
                    .getKeyCodeString()}</code>`
            )}</span>
        `
            );
        }

        // Create the waypoint list on the upper right
        this.waypointsListElement = makeDiv(parent, "ingame_HUD_Waypoints", [], "Waypoints");
    }

    /**
     * Serializes the waypoints
     */
    serialize() {
        return {
            waypoints: this.waypoints,
        };
    }

    /**
     * Deserializes the waypoints
     * @param {{waypoints: Array<Waypoint>}} data
     */
    deserialize(data) {
        if (!data || !data.waypoints || !Array.isArray(data.waypoints)) {
            return "Invalid waypoints data";
        }
        this.waypoints = data.waypoints;
        this.rerenderWaypointList();
    }

    /**
     * Initializes everything
     */
    initialize() {
        // Cache the sprite for the waypoints

        this.waypointSprites = {
            regular: Loader.getSprite("sprites/misc/waypoint.png"),
            wires: Loader.getSprite("sprites/misc/waypoint_wires.png"),
        };

        this.directionIndicatorSprite = Loader.getSprite("sprites/misc/hub_direction_indicator.png");

        /** @type {Array<Waypoint>}
         */
        this.waypoints = [
            // {
            //     label: null,
            //     center: { x: 0, y: 0 },
            //     zoomLevel: 3,
            //     layer: gMetaBuildingRegistry.findByClass(MetaHubBuilding).getLayer(),
            // },
        ];

        // Create a buffer we can use to measure text
        this.dummyBuffer = makeOffscreenBuffer(1, 1, {
            reusable: false,
            label: "waypoints-measure-canvas",
        })[1];

        // Dynamically attach/detach the lower right hint in the map overview
        if (this.hintElement) {
            this.domAttach = new DynamicDomAttach(this.root, this.hintElement);
        }

        // Catch mouse and key events
        this.root.camera.downPreHandler.add(this.onMouseDown, this);
        this.root.keyMapper
            .getBinding(KEYMAPPINGS.navigation.createMarker)
            .add(() => this.requestSaveMarker({}));

        /**
         * Stores at how much opacity the markers should be rendered on the map.
         * This is interpolated over multiple frames so we have some sort of fade effect
         */
        this.currentMarkerOpacity = 1;
        this.currentCompassOpacity = 0;

        // // Create buffer which is used to indicate the hub direction
        // const [canvas, context] = makeOffscreenBuffer(48, 48, {
        //     smooth: true,
        //     reusable: false,
        //     label: "waypoints-compass",
        // });
        // this.compassBuffer = { canvas, context };

        /**
         * Store cached text widths
         * @type {Object<string, number>}
         */
        this.cachedTextWidths = {};

        // Initial render
        this.rerenderWaypointList();
    }

    /**
     * Returns how long a text will be rendered
     * @param {string} text
     * @returns {number}
     */
    getTextWidth(text) {
        if (this.cachedTextWidths[text]) {
            return this.cachedTextWidths[text];
        }

        this.dummyBuffer.font = "bold " + this.getTextScale() + "px GameFont";
        return (this.cachedTextWidths[text] = this.dummyBuffer.measureText(text).width);
    }

    /**
     * Returns how big the text should be rendered
     */
    getTextScale() {
        return this.getWaypointUiScale() * 12;
    }

    /**
     * Returns the scale for rendering waypoints
     */
    getWaypointUiScale() {
        return this.root.app.getEffectiveUiScale();
    }

    /**
     * Re-renders the waypoint list to account for changes
     */
    rerenderWaypointList() {
        removeAllChildren(this.waypointsListElement);
        this.cleanupClickDetectors();

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const label = this.getWaypointLabel(waypoint);

            const element = makeDiv(this.waypointsListElement, null, ["waypoint"]);
            element.innerText = label;

            if (this.isWaypointDeletable(waypoint)) {
                const editButton = makeDiv(element, null, ["editButton"]);
                this.trackClicks(editButton, () => this.requestSaveMarker({ waypoint }));
            }

            // if (!waypoint.label) {
            //     // This must be the hub label
            //     element.classList.add("hub");
            //     element.insertBefore(this.compassBuffer.canvas, element.childNodes[0]);
            // }

            this.trackClicks(element, () => this.moveToWaypoint(waypoint), {
                targetOnly: true,
            });
        }
    }

    /**
     * Moves the camera to a given waypoint
     * @param {Waypoint} waypoint
     */
    moveToWaypoint(waypoint) {
        this.root.camera.setDesiredCenter(new Vector(waypoint.center.x, waypoint.center.y));
        this.root.camera.setDesiredZoom(waypoint.zoomLevel);
    }

    /**
     * Deletes a waypoint from the list
     * @param {Waypoint} waypoint
     */
    deleteWaypoint(waypoint) {
        arrayDeleteValue(this.waypoints, waypoint);
        this.rerenderWaypointList();
    }

    /**
     * Requests to save a marker at the current camera position. If worldPos is set,
     * uses that position instead.
     * @param {object} param0
     * @param {Vector=} param0.worldPos Override the world pos, otherwise it is the camera position
     * @param {Waypoint=} param0.waypoint Waypoint to be edited. If omitted, create new
     */
    requestSaveMarker({ worldPos = null, waypoint = null }) {
        // Construct dialog with input field
        const markerNameInput = new FormElementInput({
            id: "markerName",
            label: null,
            placeholder: "",
            defaultValue: waypoint ? waypoint.label : "",
            validator: val => val.length > 0 && val.length < MAX_LABEL_LENGTH,
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: waypoint ? T.dialogs.createMarker.titleEdit : T.dialogs.createMarker.title,
            desc: fillInLinkIntoTranslation(T.dialogs.createMarker.desc, THIRDPARTY_URLS.shapeViewer),
            formElements: [markerNameInput],
            buttons: waypoint ? ["delete:bad", "cancel", "ok:good"] : ["cancel", "ok:good"],
        });
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        // Edit marker
        if (waypoint) {
            dialog.buttonSignals.ok.add(() => {
                // Actually rename the waypoint
                this.renameWaypoint(waypoint, markerNameInput.getValue());
            });
            dialog.buttonSignals.delete.add(() => {
                // Actually delete the waypoint
                this.deleteWaypoint(waypoint);
            });
        } else {
            // Compute where to create the marker
            const center = worldPos || this.root.camera.center;

            dialog.buttonSignals.ok.add(() => {
                // Show info that you can have only N markers in the demo,
                // actually show this *after* entering the name so you want the
                // standalone even more (I'm evil :P)
                if (this.waypoints.length > this.root.app.restrictionMgr.getMaximumWaypoints()) {
                    this.root.hud.parts.dialogs.showFeatureRestrictionInfo(
                        "",
                        T.dialogs.markerDemoLimit.desc
                    );
                    return;
                }

                // Actually create the waypoint
                this.addWaypoint(markerNameInput.getValue(), center);
            });
        }
    }

    /**
     * Adds a new waypoint at the given location with the given label
     * @param {string} label
     * @param {Vector} position
     */
    addWaypoint(label, position) {
        this.waypoints.push({
            label,
            center: { x: position.x, y: position.y },
            zoomLevel: this.root.camera.zoomLevel,
            layer: this.root.currentLayer,
        });

        this.sortWaypoints();

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Renames a waypoint with the given label
     * @param {Waypoint} waypoint
     * @param {string} label
     */
    renameWaypoint(waypoint, label) {
        waypoint.label = label;

        this.sortWaypoints();

        // Re-render the list and thus add it
        this.rerenderWaypointList();
    }

    /**
     * Called every frame to update stuff
     */
    update() {
        if (this.domAttach) {
            this.domAttach.update(this.root.camera.getIsMapOverlayActive());
        }
    }

    /**
     * Sort waypoints by name
     */
    sortWaypoints() {
        this.waypoints.sort((a, b) => {
            if (!a.label) {
                return -1;
            }
            if (!b.label) {
                return 1;
            }
            return this.getWaypointLabel(a)
                .padEnd(MAX_LABEL_LENGTH, "0")
                .localeCompare(this.getWaypointLabel(b).padEnd(MAX_LABEL_LENGTH, "0"));
        });
    }

    /**
     * Returns the label for a given waypoint
     * @param {Waypoint} waypoint
     * @returns {string}
     */
    getWaypointLabel(waypoint) {
        return waypoint.label || T.ingame.waypoints.hub;
    }

    /**
     * Returns if a waypoint is deletable
     * @param {Waypoint} waypoint
     * @returns {boolean}
     */
    isWaypointDeletable(waypoint) {
        return waypoint.label !== null;
    }

    /**
     * Returns the screen space bounds of the given waypoint or null
     * if it couldn't be determined. Also returns wheter its a shape or not
     * @param {Waypoint} waypoint
     * @return {{
     *   screenBounds: Rectangle
     *   item: BaseItem|null,
     *   text: string
     * }}
     */
    getWaypointScreenParams(waypoint) {
        if (!this.root.camera.getIsMapOverlayActive()) {
            return null;
        }

        // Find parameters
        const scale = this.getWaypointUiScale();
        const screenPos = this.root.camera.worldToScreen(new Vector(waypoint.center.x, waypoint.center.y));

        // Distinguish between text and item waypoints -> Figure out parameters
        const originalLabel = this.getWaypointLabel(waypoint);
        let text, item, textWidth;

        // Otherwise render a regular waypoint
        text = originalLabel;
        textWidth = this.getTextWidth(text);

        return {
            screenBounds: new Rectangle(
                screenPos.x - 7 * scale,
                screenPos.y - 12 * scale,
                15 * scale + textWidth,
                15 * scale
            ),
            item,
            text,
        };
    }

    /**
     * Finds the currently intersected waypoint on the map overview under
     * the cursor.
     *
     * @returns {Waypoint | null}
     */
    findCurrentIntersectedWaypoint() {
        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            return;
        }

        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];
            const params = this.getWaypointScreenParams(waypoint);
            if (params && params.screenBounds.containsPoint(mousePos.x, mousePos.y)) {
                return waypoint;
            }
        }
    }

    /**
     * Mouse-Down handler
     * @param {Vector} pos
     * @param {enumMouseButton} button
     */
    onMouseDown(pos, button) {
        const waypoint = this.findCurrentIntersectedWaypoint();
        if (waypoint) {
            if (button === enumMouseButton.left) {
                this.root.soundProxy.playUiClick();
                this.moveToWaypoint(waypoint);
            } else if (button === enumMouseButton.right) {
                if (this.isWaypointDeletable(waypoint)) {
                    this.root.soundProxy.playUiClick();
                    this.requestSaveMarker({ waypoint });
                } else {
                    this.root.soundProxy.playUiError();
                }
            }

            return STOP_PROPAGATION;
        } else {
            // Allow right click to create a marker
            if (button === enumMouseButton.right) {
                if (this.root.camera.getIsMapOverlayActive()) {
                    const worldPos = this.root.camera.screenToWorld(pos);
                    this.requestSaveMarker({ worldPos });
                    return STOP_PROPAGATION;
                }
            }
        }
    }

    /**
     * Draws the waypoints on the map
     * @param {DrawParameters} parameters
     */
    drawOverlays(parameters) {
        const mousePos = this.root.app.mousePosition;
        const desiredOpacity = this.root.camera.getIsMapOverlayActive() ? 1 : 0;
        this.currentMarkerOpacity = lerp(this.currentMarkerOpacity, desiredOpacity, 0.08);

        // this.rerenderWaypointsCompass();

        // Don't render with low opacity
        if (this.currentMarkerOpacity < 0.01) {
            return;
        }

        // Determine rendering scale
        const scale = this.getWaypointUiScale();

        // Set the font size
        const textSize = this.getTextScale();
        parameters.context.font = "bold " + textSize + "px GameFont";
        parameters.context.textBaseline = "middle";

        // Loop over all waypoints
        for (let i = 0; i < this.waypoints.length; ++i) {
            const waypoint = this.waypoints[i];

            const waypointData = this.getWaypointScreenParams(waypoint);
            if (!waypointData) {
                // Not relevant
                continue;
            }

            if (!parameters.visibleRect.containsRect(waypointData.screenBounds)) {
                // Out of screen
                continue;
            }

            const bounds = waypointData.screenBounds;
            const contentPaddingX = 7 * scale;
            const isSelected = mousePos && bounds.containsPoint(mousePos.x, mousePos.y);

            // Render the background rectangle
            parameters.context.globalAlpha = this.currentMarkerOpacity * (isSelected ? 1 : 0.7);
            parameters.context.fillStyle = "rgba(255, 255, 255, 0.7)";
            parameters.context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

            // Render the text
            if (waypointData.text) {
                // Render the text
                parameters.context.fillStyle = "#000";
                parameters.context.textBaseline = "middle";
                parameters.context.fillText(
                    waypointData.text,
                    bounds.x + contentPaddingX + 6 * scale,
                    bounds.y + bounds.h / 2
                );
                parameters.context.textBaseline = "alphabetic";
            } else {
                assertAlways(false, "Waypoint has no item and text");
            }

            // Render the small icon on the left
            this.waypointSprites[this.root.currentLayer].drawCentered(
                parameters.context,
                bounds.x + contentPaddingX,
                bounds.y + bounds.h / 2,
                bounds.h * 0.6
            );
        }

        parameters.context.textBaseline = "alphabetic";
        parameters.context.globalAlpha = 1;
    }
}
