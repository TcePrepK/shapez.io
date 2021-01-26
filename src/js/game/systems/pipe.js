import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Loader } from "../../core/loader";
import { createLogger } from "../../core/logging";
import { fastArrayDeleteValue } from "../../core/utils";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../../core/vector";
import { PipePath } from "../pipe_path";
import { arrayPipeVariantToRotation, MetaPipeBuilding } from "../buildings/pipe";
import { getCodeFromBuildingData } from "../building_codes";
import { enumPipeVariant, PipeComponent } from "../components/pipe";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";
import { defaultBuildingVariant } from "../meta_building";

const logger = createLogger("pipe");

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

        this.root.signals.entityDestroyed.add(this.onEntityDestroyed, this);
        this.root.signals.entityDestroyed.add(this.updateSurroundingPipePlacement, this);

        // Notice: These must come *after* the entity destroyed signals
        this.root.signals.entityAdded.add(this.onEntityAdded, this);
        this.root.signals.entityAdded.add(this.updateSurroundingPipePlacement, this);

        /** @type {Array<PipePath>} */
        this.pipePaths = [];
    }

    /**
     * Serializes all pipe paths
     * @returns {Array<object>}
     */
    serializePaths() {
        let data = [];
        for (let i = 0; i < this.pipePaths.length; ++i) {
            data.push(this.pipePaths[i].serialize());
        }
        return data;
    }

    /**
     * Deserializes all pipe paths
     * @param {Array<any>} data
     */
    deserializePaths(data) {
        if (!Array.isArray(data)) {
            return "Pipe paths are not an array: " + typeof data;
        }

        for (let i = 0; i < data.length; ++i) {
            const path = PipePath.fromSerialized(this.root, data[i]);
            // If path is a string, that means its an error
            if (!(path instanceof PipePath)) {
                return "Failed to create path from pipe data: " + path;
            }
            this.pipePaths.push(path);
        }

        if (this.pipePaths.length === 0) {
            // Old savegames might not have paths yet
            logger.warn("Recomputing pipe paths (most likely the savegame is old or empty)");
            this.recomputeAllPipePaths();
        } else {
            logger.warn("Restored", this.pipePaths.length, "pipe paths");
        }

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }
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

        /** @type {Set<PipePath>} */
        const changedPaths = new Set();

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
                        const originalPath = targetPipeComp.assignedPath;

                        // Ok, first remove it from its current path
                        this.deleteEntityFromPath(targetPipeComp.assignedPath, targetEntity);

                        // Change stuff
                        targetStaticComp.rotation = rotation;
                        metaPipe.updateVariants(targetEntity, rotationVariant, targetPipeComp.variant);

                        // Update code as well
                        targetStaticComp.code = getCodeFromBuildingData(
                            metaPipe,
                            targetPipeComp.variant,
                            rotationVariant
                        );

                        // Update the original path since it might have picked up the entit1y
                        originalPath.onPathChanged();

                        // Now add it again
                        this.addEntityToPaths(targetEntity);

                        // Sanity
                        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
                            this.debug_verifyPipePaths();
                        }

                        // Make sure the chunks know about the update
                        this.root.signals.entityChanged.dispatch(targetEntity);
                    }

                    if (targetPipeComp.assignedPath) {
                        changedPaths.add(targetPipeComp.assignedPath);
                    }
                }
            }
        }

        // notify all paths *afterwards* to avoid multi-updates
        changedPaths.forEach(path => path.onSurroundingsChanged());

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }
    }

    /**
     * Called when an entity got destroyed
     * @param {Entity} entity
     */
    onEntityDestroyed(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (!entity.components.Pipe) {
            return;
        }

        const assignedPath = entity.components.Pipe.assignedPath;
        assert(assignedPath, "Entity has no pipe path assigned");
        this.deleteEntityFromPath(assignedPath, entity);
        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }
    }

    /**
     * Attempts to delete the pipe from its current path
     * @param {PipePath} path
     * @param {Entity} entity
     */
    deleteEntityFromPath(path, entity) {
        if (path.entityPath.length === 1) {
            // This is a single entity path, easy to do, simply erase whole path
            fastArrayDeleteValue(this.pipePaths, path);
            return;
        }

        // Notice: Since there might be circular references, it is important to check
        // which role the entity has
        if (path.isStartEntity(entity)) {
            // We tried to delete the start
            path.deleteEntityOnStart(entity);
        } else if (path.isEndEntity(entity)) {
            // We tried to delete the end
            path.deleteEntityOnEnd(entity);
        } else {
            // We tried to delete something inbetween
            const newPath = path.deleteEntityOnPathSplitIntoTwo(entity);
            this.pipePaths.push(newPath);
        }

        // Sanity
        entity.components.Pipe.assignedPath = null;
    }

    /**
     * Adds the given entity to the appropriate paths
     * @param {Entity} entity
     */
    addEntityToPaths(entity) {
        const fromEntity = this.findSupplyingEntity(entity);
        const toEntity = this.findFollowUpEntity(entity);

        // console.log(fromEntity);
        // console.log(toEntity);

        // Check if we can add the entity to the previous path
        if (fromEntity) {
            const fromPath = fromEntity.components.Pipe.assignedPath;
            fromPath.extendOnEnd(entity);

            // console.log(fromPath);

            // Check if we now can extend the current path by the next path
            if (toEntity) {
                const toPath = toEntity.components.Pipe.assignedPath;

                if (fromPath === toPath) {
                    // This is a circular dependency -> Ignore
                } else {
                    fromPath.extendByPath(toPath);

                    // Delete now obsolete path
                    fastArrayDeleteValue(this.pipePaths, toPath);
                }
            }
        } else {
            if (toEntity) {
                // Prepend it to the other path
                const toPath = toEntity.components.Pipe.assignedPath;
                toPath.extendOnBeginning(entity);
            } else {
                // This is an empty pipe path
                const path = new PipePath(this.root, [entity]);
                this.pipePaths.push(path);
            }
        }
    }

    /**
     * Called when an entity got added
     * @param {Entity} entity
     */
    onEntityAdded(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (!entity.components.Pipe) {
            return;
        }

        this.addEntityToPaths(entity);
        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }
    }

    /**
     * Draws all pipe paths
     * @param {DrawParameters} parameters
     */
    drawPipeFluids(parameters) {
        for (let i = 0; i < this.pipePaths.length; ++i) {
            this.pipePaths[i].draw(parameters);
        }
    }

    /**
     * Verifies all pipe paths
     */
    debug_verifyPipePaths() {
        for (let i = 0; i < this.pipePaths.length; ++i) {
            this.pipePaths[i].debug_checkIntegrity("general-verify");
        }

        const pipes = this.root.entityMgr.getAllWithComponent(PipeComponent);
        for (let i = 0; i < pipes.length; ++i) {
            const path = pipes[i].components.Pipe.assignedPath;
            if (!path) {
                throw new Error("Pipe has no path: " + pipes[i].uid);
            }
            if (this.pipePaths.indexOf(path) < 0) {
                throw new Error("Path of entity not contained: " + pipes[i].uid);
            }
        }
    }

    /**
     * Finds the follow up entity for a given pipe. Used for building the dependencies
     * @param {Entity} entity
     * @returns {Entity|null}
     */
    findFollowUpEntity(entity) {
        const staticComp = entity.components.StaticMapEntity;
        const pipeComp = entity.components.Pipe;

        const followUpDirection = staticComp.localDirectionToWorld(pipeComp.direction);
        const followUpVector = enumDirectionToVector[followUpDirection];

        const followUpTile = staticComp.origin.add(followUpVector);
        const followUpEntity = this.root.map.getLayerContentXY(followUpTile.x, followUpTile.y, entity.layer);

        // Check if there's a pipe at the tile we point to
        if (followUpEntity) {
            const followUpPipeComp = followUpEntity.components.Pipe;
            if (followUpPipeComp) {
                const followUpStatic = followUpEntity.components.StaticMapEntity;

                const acceptedDirection = followUpStatic.localDirectionToWorld(enumDirection.top);
                if (acceptedDirection === followUpDirection) {
                    return followUpEntity;
                }
            }
        }

        return null;
    }

    /**
     * Finds the supplying pipe for a given pipe. Used for building the dependencies
     * @param {Entity} entity
     * @returns {Entity|null}
     */
    findSupplyingEntity(entity) {
        const staticComp = entity.components.StaticMapEntity;

        const supplyDirection = staticComp.localDirectionToWorld(enumDirection.bottom);
        const supplyVector = enumDirectionToVector[supplyDirection];

        const supplyTile = staticComp.origin.add(supplyVector);
        const supplyEntity = this.root.map.getLayerContentXY(supplyTile.x, supplyTile.y, entity.layer);

        // Check if there's a pipe at the tile we point to
        if (supplyEntity) {
            const supplyPipeComp = supplyEntity.components.Pipe;
            if (supplyPipeComp) {
                const supplyStatic = supplyEntity.components.StaticMapEntity;
                const otherDirection = supplyStatic.localDirectionToWorld(
                    enumInvertedDirections[supplyPipeComp.direction]
                );

                if (otherDirection === supplyDirection) {
                    return supplyEntity;
                }
            }
        }

        return null;
    }

    /**
     * Recomputes the pipe path network. Only required for old savegames
     */
    recomputeAllPipePaths() {
        logger.warn("Recomputing all pipe paths");
        const visitedUids = new Set();

        const result = [];

        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            if (visitedUids.has(entity.uid)) {
                continue;
            }

            // Mark entity as visited
            visitedUids.add(entity.uid);

            // Compute path, start with entity and find precedors / successors
            const path = [entity];

            // Prevent infinite loops
            let maxIter = 99999;

            // Find precedors
            let prevEntity = this.findSupplyingEntity(entity);
            while (prevEntity && --maxIter > 0) {
                if (visitedUids.has(prevEntity.uid)) {
                    break;
                }
                path.unshift(prevEntity);
                visitedUids.add(prevEntity.uid);
                prevEntity = this.findSupplyingEntity(prevEntity);
            }

            // Find succedors
            let nextEntity = this.findFollowUpEntity(entity);
            while (nextEntity && --maxIter > 0) {
                if (visitedUids.has(nextEntity.uid)) {
                    break;
                }

                path.push(nextEntity);
                visitedUids.add(nextEntity.uid);
                nextEntity = this.findFollowUpEntity(nextEntity);
            }

            assert(maxIter > 1, "Ran out of iterations");
            result.push(new PipePath(this.root, path));
        }

        logger.log("Found", this.pipePaths.length, "pipe paths");
        this.pipePaths = result;
    }

    /**
     * Updates all pipes
     */
    update() {
        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }

        for (let i = 0; i < this.pipePaths.length; ++i) {
            this.pipePaths[i].update();
        }

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_verifyPipePaths();
        }
    }

    /**
     * Draws a given chunk
     * @param {DrawParameters} parameters
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

    /**
     * Draws the pipe path debug overlays
     * @param {DrawParameters} parameters
     */
    drawPipePathDebug(parameters) {
        for (let i = 0; i < this.pipePaths.length; ++i) {
            this.pipePaths[i].drawDebug(parameters);
        }
    }
}
