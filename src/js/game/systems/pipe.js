import { globalConfig } from "../../core/config";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Loader } from "../../core/loader";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../../core/vector";
import { arrayPipeVariantToRotation, MetaPipeBuilding } from "../buildings/pipe";
import { getCodeFromBuildingData } from "../building_codes";
import { enumPipeVariant, PipeComponent } from "../components/pipe";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";
import { defaultBuildingVariant } from "../meta_building";

/**
 * Manages all pipes
 */
export class PipeSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [PipeComponent]);

        this.pipeSprites = {
            [defaultBuildingVariant]: {
                [enumDirection.top]: Loader.getSprite("sprites/pipes/pipe_top.png"),
                [enumDirection.left]: Loader.getSprite("sprites/pipes/pipe_left.png"),
                [enumDirection.right]: Loader.getSprite("sprites/pipes/pipe_right.png"),
            },

            [enumPipeVariant.industrial]: {
                [enumDirection.top]: Loader.getSprite("sprites/pipes/industrial_top.png"),
                [enumDirection.left]: Loader.getSprite("sprites/pipes/industrial_left.png"),
                [enumDirection.right]: Loader.getSprite("sprites/pipes/industrial_right.png"),
            },
        };

        this.root.signals.entityDestroyed.add(this.updateSurroundingPipePlacement, this);

        // Notice: These must come *after* the entity destroyed signals
        this.root.signals.entityAdded.add(this.updateSurroundingPipePlacement, this);
    }

    /**
     * Updates the pipe placement after an entity has been added / deleted
     * @param {Entity} entity
     */
    updateSurroundingPipePlacement(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp) {
            return;
        }

        const metaPipe = gMetaBuildingRegistry.findByClass(MetaPipeBuilding);
        // Compute affected area
        const originalRect = staticComp.getTileSpaceBounds();
        const affectedArea = originalRect.expandedInAllDirections(1);

        for (let x = affectedArea.x; x < affectedArea.right(); ++x) {
            for (let y = affectedArea.y; y < affectedArea.bottom(); ++y) {
                if (originalRect.containsPoint(x, y)) {
                    // Make sure we don't update the original entity
                    continue;
                }

                const targetEntities = this.root.map.getLayersContentsMultipleXY(x, y);
                for (let i = 0; i < targetEntities.length; ++i) {
                    const targetEntity = targetEntities[i];

                    const targetPipeComp = targetEntity.components.Pipe;
                    const targetStaticComp = targetEntity.components.StaticMapEntity;

                    if (!targetPipeComp) {
                        // Not a pipe
                        continue;
                    }

                    const {
                        rotation,
                        rotationVariant,
                    } = metaPipe.computeOptimalDirectionAndRotationVariantAtTile({
                        root: this.root,
                        tile: new Vector(x, y),
                        rotation: targetStaticComp.originalRotation,
                        variant: targetPipeComp.variant,
                        layer: targetEntity.layer,
                    });

                    // Compute delta to see if anything changed
                    const newDirection = arrayPipeVariantToRotation[rotationVariant];

                    if (targetStaticComp.rotation !== rotation || newDirection !== targetPipeComp.direction) {
                        // Change stuff
                        targetStaticComp.rotation = rotation;
                        metaPipe.updateVariants(targetEntity, rotationVariant, targetPipeComp.variant);

                        // Update code as well
                        targetStaticComp.code = getCodeFromBuildingData(
                            metaPipe,
                            targetPipeComp.variant,
                            rotationVariant
                        );

                        // Make sure the chunks know about the update
                        this.root.signals.entityChanged.dispatch(targetEntity);
                    }
                }
            }
        }
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        // Limit speed to avoid pipes going backwards
        const speedMultiplier = Math.min(this.root.hubGoals.getBeltBaseSpeed(), 10);
        const contents = chunk.containedEntitiesByLayer.regular;

        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            for (let i = 0; i < contents.length; ++i) {
                const entity = contents[i];
                if (entity.components.Pipe) {
                    const variant = entity.components.Pipe.variant;
                    const rotationVariant = entity.components.Pipe.direction;
                    let sprite = this.pipeSprites[variant][rotationVariant];

                    // Culling happens within the static map entity component
                    entity.components.StaticMapEntity.drawSpriteOnBoundsClipped(parameters, sprite, 0);
                }
            }
        } else {
            for (let i = 0; i < contents.length; ++i) {
                const entity = contents[i];
                if (entity.components.Pipe) {
                    const variant = entity.components.Pipe.variant;
                    const rotationVariant = entity.components.Pipe.direction;
                    const sprite = this.pipeSprites[variant][rotationVariant];

                    // Culling happens within the static map entity component
                    entity.components.StaticMapEntity.drawSpriteOnBoundsClipped(parameters, sprite, 0);

                    const staticComp = entity.components.StaticMapEntity;

                    // DEBUG Rendering
                    if (G_IS_DEV && globalConfig.debug.renderPipeRotations) {
                        parameters.context.globalAlpha = 1;
                        parameters.context.fillStyle = "red";
                        parameters.context.font = "5px Tahoma";
                        parameters.context.fillText(
                            "" + staticComp.originalRotation,
                            staticComp.origin.x * globalConfig.tileSize,
                            staticComp.origin.y * globalConfig.tileSize + 5
                        );

                        parameters.context.fillStyle = "rgba(255, 0, 0, 0.2)";
                        if (staticComp.originalRotation % 180 === 0) {
                            parameters.context.fillRect(
                                (staticComp.origin.x + 0.5) * globalConfig.tileSize,
                                staticComp.origin.y * globalConfig.tileSize,
                                3,
                                globalConfig.tileSize
                            );
                        } else {
                            parameters.context.fillRect(
                                staticComp.origin.x * globalConfig.tileSize,
                                (staticComp.origin.y + 0.5) * globalConfig.tileSize,
                                globalConfig.tileSize,
                                3
                            );
                        }
                    }
                }
            }
        }
    }
}
