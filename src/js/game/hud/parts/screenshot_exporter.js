import { makeOffscreenBuffer } from "../../../core/buffer_utils";
import { globalConfig } from "../../../core/config";
import { DrawParameters } from "../../../core/draw_parameters";
import { createLogger } from "../../../core/logging";
import { Rectangle } from "../../../core/rectangle";
import { Vector } from "../../../core/vector";
import { T } from "../../../translations";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { KEYMAPPINGS } from "../../key_action_mapper";
import { BaseHUDPart } from "../base_hud_part";
import { DialogWithForm } from "../../../core/modal_dialog_elements";
import { FormElementCheckbox, FormElementEnum } from "../../../core/modal_dialog_forms";
import { ORIGINAL_SPRITE_SCALE } from "../../../core/sprites";
import { getDeviceDPI } from "../../../core/dpi_manager";
import { HUDMassSelector } from "./mass_selector";
import { clamp } from "../../../core/utils";
import { CHUNK_OVERLAY_RES } from "../../map_chunk_view";

const logger = createLogger("screenshot_exporter");

const MAX_CANVAS_DIMS = 16384;
// should be odd so that the centers of tiles are rendered
// as pixels per tile must be a multiple of this
const TARGET_INVERSE_BORDER = 3;

const screenshotQualities = [
    {
        id: "high",
        resolution: MAX_CANVAS_DIMS,
    },
    {
        id: "medium",
        resolution: MAX_CANVAS_DIMS / 4,
    },
    {
        id: "low",
        resolution: MAX_CANVAS_DIMS / 16,
    },
    {
        id: "pixels",
        resolution: 0,
    },
];
// @TODO: translation (T.dialogs.exportScreenshotWarning.qualities)
const qualityNames = { high: "High", medium: "Medium", low: "Low", pixels: "Pixels" };

export class HUDScreenshotExporter extends BaseHUDPart {
    createElements() {}

    initialize() {
        this.root.keyMapper.getBinding(KEYMAPPINGS.ingame.exportScreenshot).add(this.startExport, this);
    }

    startExport() {
        if (!this.root.app.restrictionMgr.getIsExportingScreenshotsPossible()) {
            this.root.hud.parts.dialogs.showFeatureRestrictionInfo(T.demo.features.exportingBase);
            return;
        }

        let bounds = undefined;
        const massSelector = this.root.hud.parts.massSelector;
        if (massSelector instanceof HUDMassSelector) {
            if (massSelector.currentSelectionStartWorld) {
                const worldStart = massSelector.currentSelectionStartWorld;
                const worldEnd = this.root.camera.screenToWorld(massSelector.currentSelectionEnd);

                const tileStart = worldStart.toTileSpace();
                const tileEnd = worldEnd.toTileSpace();

                bounds = Rectangle.fromTwoPoints(tileStart, tileEnd.addScalars(1, 1));
            } else if (massSelector.selectedUids.size > 0) {
                const minTile = new Vector(Infinity, Infinity);
                const maxTile = new Vector(-Infinity, -Infinity);

                const entityUids = Array.from(massSelector.selectedUids);
                for (let i = 0; i < entityUids.length; ++i) {
                    const entityBounds = this.root.entityMgr
                        .findByUid(entityUids[i])
                        .components.StaticMapEntity.getTileSpaceBounds();

                    minTile.x = Math.min(minTile.x, entityBounds.x);
                    minTile.y = Math.min(minTile.y, entityBounds.y);

                    maxTile.x = Math.max(maxTile.x, entityBounds.x + entityBounds.w);
                    maxTile.y = Math.max(maxTile.y, entityBounds.y + entityBounds.h);
                }

                bounds = Rectangle.fromTwoPoints(minTile, maxTile);
            }
        }

        const qualityInput = new FormElementEnum({
            id: "screenshotQuality",
            label: "Quality",
            options: screenshotQualities,
            valueGetter: quality => quality.resolution,
            // @TODO: translation (T.dialogs.exportScreenshotWarning.qualityLabel)
            textGetter: quality => qualityNames[quality.id],
        });
        const overlayInput = new FormElementCheckbox({
            id: "screenshotView",
            // @TODO: translation (T.dialogs.exportScreenshotWarning.descOverlay)
            label: "Map view",
            defaultValue: this.root.camera.getIsMapOverlayActive() ? true : false,
        });
        const layerInput = new FormElementCheckbox({
            id: "screenshotLayer",
            // @TODO: translation (T.dialogs.exportScreenshotWarning.descLayer)
            label: "Include wires layer",
            defaultValue: this.root.currentLayer === "wires" ? true : false,
        });
        const dialog = new DialogWithForm({
            app: this.root.app,
            title: T.dialogs.exportScreenshotWarning.title,
            desc: T.dialogs.exportScreenshotWarning.desc,
            formElements: [qualityInput, overlayInput, layerInput],
            buttons: ["cancel:good", "ok:bad"],
        });

        dialog.inputReciever.keydown.add(({ keyCode }) => {
            if (keyCode === KEYMAPPINGS.ingame.exportScreenshot.keyCode) {
                this.root.hud.parts.dialogs.closeDialog(dialog);
            }
        });

        this.root.hud.parts.dialogs.internalShowDialog(dialog);
        dialog.buttonSignals.ok.add(
            () =>
                this.doExport(
                    qualityInput.getValue(),
                    overlayInput.getValue(),
                    layerInput.getValue(),
                    !!bounds,
                    bounds
                ),
            this
        );
    }

    /**
     * Renders a screenshot of the entire base as closely as possible to the ingame camera
     * @param {number} targetResolution
     * @param {boolean} overlay
     * @param {boolean} wiresLayer
     * @param {boolean} allowBorder
     * @param {Rectangle?} tileBounds
     */
    doExport(targetResolution, overlay, wiresLayer, allowBorder, tileBounds) {
        logger.log("Starting export ...");

        if (!tileBounds) {
            // Find extends
            const staticEntities = this.root.entityMgr.getAllWithComponent(StaticMapEntityComponent);

            const minTile = new Vector(0, 0);
            const maxTile = new Vector(0, 0);
            for (let i = 0; i < staticEntities.length; ++i) {
                const entityBounds = staticEntities[i].components.StaticMapEntity.getTileSpaceBounds();
                minTile.x = Math.min(minTile.x, entityBounds.x);
                minTile.y = Math.min(minTile.y, entityBounds.y);

                maxTile.x = Math.max(maxTile.x, entityBounds.x + entityBounds.w);
                maxTile.y = Math.max(maxTile.y, entityBounds.y + entityBounds.h);
            }

            minTile.x = Math.floor(minTile.x / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;
            minTile.y = Math.floor(minTile.y / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;

            maxTile.x = Math.ceil(maxTile.x / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;
            maxTile.y = Math.ceil(maxTile.y / globalConfig.mapChunkSize) * globalConfig.mapChunkSize;

            tileBounds = Rectangle.fromTwoPoints(minTile, maxTile);
        }

        // if the desired pixels per tile is too small, we do not create a border
        // so that we have more valid values for pixels per tile
        // we do not create a border for map view since there is no sprite overflow
        const border =
            allowBorder &&
            !overlay &&
            targetResolution / (Math.max(tileBounds.w, tileBounds.h) + 2 / TARGET_INVERSE_BORDER) >=
                3 * TARGET_INVERSE_BORDER;

        const bounds = border ? tileBounds.expandedInAllDirections(1 / TARGET_INVERSE_BORDER) : tileBounds;
        logger.log("Bounds:", bounds);

        const maxDimensions = Math.max(bounds.w, bounds.h);

        // at least 3 pixels per tile, for bearable quality
        // at most the resolution of the assets, to not be excessive
        const clamped = clamp(
            targetResolution / (maxDimensions + (border ? 2 / 3 : 0)),
            3,
            globalConfig.assetsDpi * globalConfig.tileSize
        );

        // 1 is a fake value since it behaves the same as a border width of 0
        const inverseBorder = border ? TARGET_INVERSE_BORDER : 1;
        const tileSizePixels = overlay
            ? // we floor to the nearest multiple of the map view tile resolution
              Math.floor(clamped / CHUNK_OVERLAY_RES) * CHUNK_OVERLAY_RES || CHUNK_OVERLAY_RES
            : // we floor to the nearest odd multiple so that the center of each building is rendered
              Math.floor((clamped + inverseBorder) / (2 * inverseBorder)) * (2 * inverseBorder) -
                  inverseBorder || inverseBorder;
        logger.log("Pixels per tile:", tileSizePixels);

        if (Math.round(tileSizePixels * maxDimensions) > MAX_CANVAS_DIMS) {
            logger.error("Maximum canvas size exceeded, aborting");
            // @TODO: translation (T.dialogs.exportScreenshotFail.title) (T.dialogs.exportScreenshotFail.text)
            this.root.hud.parts.dialogs.showInfo("Too large", "The base is too large to render, sorry!");
            return;
        }

        const zoomLevel = tileSizePixels / globalConfig.tileSize;
        logger.log("Scale:", zoomLevel);

        // Compute atlas scale
        const lowQuality = this.root.app.settings.getAllSettings().lowQualityTextures;
        const effectiveZoomLevel = (zoomLevel / globalConfig.assetsDpi) * globalConfig.assetsSharpness;

        let desiredAtlasScale = "0.25";
        if (effectiveZoomLevel > 0.5 && !lowQuality) {
            desiredAtlasScale = ORIGINAL_SPRITE_SCALE;
        } else if (effectiveZoomLevel > 0.35 && !lowQuality) {
            desiredAtlasScale = "0.5";
        }

        logger.log("Allocating buffer, if the factory grew too big it will crash here");
        const [canvas, context] = makeOffscreenBuffer(
            Math.round(bounds.w * tileSizePixels),
            Math.round(bounds.h * tileSizePixels),
            {
                smooth: true,
                reusable: false,
                label: "export-buffer",
            }
        );
        logger.log("Got buffer, rendering now ...");

        const visibleRect = bounds.allScaled(globalConfig.tileSize);
        const parameters = new DrawParameters({
            context,
            visibleRect,
            desiredAtlasScale,
            root: this.root,
            zoomLevel: zoomLevel,
        });

        context.scale(zoomLevel, zoomLevel);
        context.translate(-visibleRect.x, -visibleRect.y);

        // hack but works
        const currentLayer = this.root.currentLayer;
        const currentAlpha = this.root.hud.parts.wiresOverlay.currentAlpha;
        if (wiresLayer) {
            this.root.currentLayer = "wires";
            this.root.hud.parts.wiresOverlay.currentAlpha = 1;
        } else {
            this.root.currentLayer = "regular";
            this.root.hud.parts.wiresOverlay.currentAlpha = 0;
        }

        // Render all relevant chunks
        this.root.signals.gameFrameStarted.dispatch();
        if (overlay) {
            this.root;
            this.root.map.drawOverlay(parameters);
        } else {
            this.root.map.drawBackground(parameters);
            this.root.systemMgr.systems.belt.drawBeltItems(parameters);
            this.root.map.drawForeground(parameters);
            this.root.systemMgr.systems.hub.draw(parameters);
            this.root.hud.parts.wiresOverlay.draw(parameters);
            if (this.root.currentLayer === "wires") {
                this.root.map.drawWiresForegroundLayer(parameters);
            }
        }

        this.root.currentLayer = currentLayer;
        this.root.hud.parts.wiresOverlay.currentAlpha = currentAlpha;

        // Offer export
        logger.log("Rendered buffer, exporting ...");
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = "base.png";
        link.href = image;
        link.click();
        logger.log("Done!");
    }
}
