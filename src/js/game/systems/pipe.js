import { globalConfig } from "../../core/config";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Loader } from "../../core/loader";
import {
    enumAngleToDirection,
    enumDirection,
    enumDirectionToVector,
    enumInvertedDirections,
    Vector,
} from "../../core/vector";
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
        // this.root.signals.entityDestroyed.add(this.updatePressure, this);

        // Notice: These must come *after* the entity destroyed signals
        this.root.signals.entityAdded.add(this.updateSurroundingPipePlacement, this);
        // this.root.signals.entityDestroyed.add(this.updatePressure, this);
    }

    update() {
        this.updatePipeConnection();
        this.updatePressure();
        this.updateFluidValume();
    }

    updateFluidValume() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const pipeComp = entity.components.Pipe;

            const fluid = pipeComp.currentValue;

            if (!fluid) {
                continue;
            }

            const currentPressure = pipeComp.currentPressure;
            const currentAmount = pipeComp.currentAmount;

            if (currentPressure === 0 || currentAmount === 0) {
                continue;
            }

            if (pipeComp.connections.length == 2) {
                const c1 = pipeComp.connections[0];
                const c2 = pipeComp.connections[1];

                const p1 = c1.components.Pipe;
                const p2 = c2.components.Pipe;

                let num = 0;

                if (p1) {
                    const a1 = p1.currentAmount;

                    if (currentAmount === a1 + 1) {
                        num++;
                    }
                }

                if (p2) {
                    const a2 = p2.currentAmount;

                    if (currentAmount === a2 + 1) {
                        num++;
                    }
                }

                if (num === 2) {
                    if (p1.currentAmount < p1.getMaxValue()) {
                        p1.currentAmount++;
                    }
                    if (p2.currentAmount < p2.getMaxValue()) {
                        p2.currentAmount++;
                    }
                }
            }

            for (let j = 0; j < pipeComp.connections.length; j++) {
                const connection = pipeComp.connections[j];
                const connectionPipeComp = connection.components.Pipe;

                if (!connectionPipeComp) {
                    continue;
                }

                const connectionFluid = connectionPipeComp.currentValue;
                const amount = connectionPipeComp.currentAmount;

                if (amount > connectionPipeComp.getMaxValue()) {
                    continue;
                }

                if (!connectionFluid) {
                    connectionPipeComp.currentValue = fluid;
                }

                if (
                    pipeComp.currentAmount > 0 &&
                    pipeComp.currentAmount > connectionPipeComp.currentAmount &&
                    connectionPipeComp.currentAmount < connectionPipeComp.getMaxValue()
                ) {
                    connectionPipeComp.currentAmount++;
                    pipeComp.currentAmount--;
                }
            }
        }
    }

    updatePressure() {
        for (let i = 0; i < this.allEntities.length; i++) {
            const entity = this.allEntities[i];
            const pipeComp = entity.components.Pipe;

            const mainPressure = pipeComp.currentPressure;

            if (pipeComp.connections.length == 0) {
                pipeComp.currentPressure = 0;

                continue;
            }

            if (pipeComp.connections.length == 1) {
                const connection = pipeComp.connections[0];

                if (connection.components.Pipe) {
                    const conPressure = connection.components.Pipe.currentPressure;

                    if (mainPressure >= conPressure && mainPressure > 0) {
                        pipeComp.currentPressure--;

                        continue;
                    }
                }
            }

            if (pipeComp.connections.length == 2) {
                const c1 = pipeComp.connections[0];
                const c2 = pipeComp.connections[1];

                let num = 0;
                if (c1.components.Pipe) {
                    const p1 = c1.components.Pipe.currentPressure;
                    if (p1 <= mainPressure) {
                        num++;
                    }
                }

                if (c2.components.Pipe) {
                    const p2 = c2.components.Pipe.currentPressure;
                    if (p2 <= mainPressure) {
                        num++;
                    }
                }

                if (num == 2 && pipeComp.currentPressure > 0) {
                    pipeComp.currentPressure--;

                    continue;
                }
            }

            for (let j = 0; j < pipeComp.connections.length; j++) {
                const connection = pipeComp.connections[j];
                const pipeCon = connection.components.Pipe;

                if (!pipeCon) {
                    continue;
                }

                const pressure = pipeCon.currentPressure;

                if (pressure > mainPressure) {
                    pipeComp.currentPressure = pressure - 1;
                }
            }
        }
    }

    updatePipeConnection() {
        for (let i = 0; i < this.allEntities.length; i++) {
            const entity = this.allEntities[i];
            const staticComp = entity.components.StaticMapEntity;
            const pipeComp = entity.components.Pipe;

            if (!staticComp || !pipeComp) {
                return;
            }

            pipeComp.connections = [];

            let angleAddition = 0;

            switch (pipeComp.direction) {
                case enumDirection.top:
                    break;
                case enumDirection.right:
                    angleAddition = 90;
                    break;
                case enumDirection.left:
                    angleAddition = 270;
                    break;
            }

            const rotation = staticComp.rotation;
            const origin = staticComp.origin;

            const posTop = origin.add(
                enumDirectionToVector[enumAngleToDirection[(rotation + angleAddition) % 360]]
            );
            const posBottom = origin.add(enumDirectionToVector[enumAngleToDirection[(rotation + 180) % 360]]);

            const topEntity = this.root.map.getLayerContentXY(posTop.x, posTop.y, "regular");
            const bottomEntity = this.root.map.getLayerContentXY(posBottom.x, posBottom.y, "regular");

            let topStatic, topPipe, bottomStatic, bottomPipe;

            if (topEntity) {
                topStatic = topEntity.components.StaticMapEntity;
                topPipe = topEntity.components.Pipe;
                const topPump = topEntity.components.Pump;

                if (topPump) {
                    pipeComp.connections.push(topEntity);
                }
            }

            if (bottomEntity) {
                bottomStatic = bottomEntity.components.StaticMapEntity;
                bottomPipe = bottomEntity.components.Pipe;
                const bottomPump = bottomEntity.components.Pump;

                if (bottomPump) {
                    pipeComp.connections.push(bottomEntity);
                }
            }

            switch (pipeComp.direction) {
                case enumDirection.top:
                    // If pipe is straight
                    if (topEntity && topPipe) {
                        let rotationAddition = 0;

                        if (topPipe.direction === enumDirection.left) {
                            rotationAddition = 270;
                        }

                        if (
                            topPipe.direction !== enumDirection.top &&
                            (topStatic.rotation === (rotation + rotationAddition) % 360 ||
                                topStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        }

                        if (
                            topPipe.direction === enumDirection.top &&
                            (topStatic.rotation === rotation || topStatic.rotation === (rotation + 180) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        }
                    }

                    if (bottomEntity && bottomPipe) {
                        let rotationAddition = 90;

                        if (bottomPipe.direction === enumDirection.right) {
                            rotationAddition = 180;
                        }

                        if (
                            bottomPipe.direction !== enumDirection.top &&
                            (bottomStatic.rotation === (rotation + rotationAddition) % 360 ||
                                bottomStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        }

                        if (
                            bottomPipe.direction === enumDirection.top &&
                            (bottomStatic.rotation === rotation ||
                                bottomStatic.rotation === (rotation + 180) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        }
                    }

                    break;
                case enumDirection.right:
                    // If pipe is turning right
                    if (topEntity && topPipe) {
                        let rotationAddition = 0;

                        if (topPipe.direction === enumDirection.right) {
                            rotationAddition = 90;
                        }

                        if (
                            topPipe.direction !== enumDirection.top &&
                            (topStatic.rotation === (rotation + rotationAddition) % 360 ||
                                topStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        } else if (
                            topPipe.direction === enumDirection.top &&
                            (topStatic.rotation === (rotation + 90) % 360 ||
                                topStatic.rotation === (rotation + 270) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        }
                    }

                    if (bottomEntity && bottomPipe) {
                        let rotationAddition = 90;

                        if (bottomPipe.direction === enumDirection.right) {
                            rotationAddition = 180;
                        }

                        if (
                            bottomPipe.direction !== enumDirection.top &&
                            (bottomStatic.rotation === (rotation + rotationAddition) % 360 ||
                                bottomStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        } else if (
                            bottomPipe.direction === enumDirection.top &&
                            (bottomStatic.rotation === rotation ||
                                bottomStatic.rotation === (rotation + 180) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        }
                    }

                    break;
                case enumDirection.left:
                    // If pipe is turning left
                    if (topEntity && topPipe) {
                        let rotationAddition = 180;

                        if (topPipe.direction === enumDirection.left) {
                            rotationAddition = 270;
                        }

                        if (
                            topPipe.direction !== enumDirection.top &&
                            (topStatic.rotation === (rotation + rotationAddition) % 360 ||
                                topStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        } else if (
                            topPipe.direction === enumDirection.top &&
                            (topStatic.rotation === (rotation + 90) % 360 ||
                                topStatic.rotation === (rotation + 270) % 360)
                        ) {
                            pipeComp.connections.push(topEntity);
                        }
                    }

                    if (bottomEntity && bottomPipe) {
                        let rotationAddition = 90;

                        if (bottomPipe.direction === enumDirection.right) {
                            rotationAddition = 180;
                        }

                        if (
                            bottomPipe.direction !== enumDirection.top &&
                            (bottomStatic.rotation === (rotation + rotationAddition) % 360 ||
                                bottomStatic.rotation === (rotation + rotationAddition + 90) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        } else if (
                            bottomPipe.direction === enumDirection.top &&
                            (bottomStatic.rotation === rotation ||
                                bottomStatic.rotation === (rotation + 180) % 360)
                        ) {
                            pipeComp.connections.push(bottomEntity);
                        }
                    }

                    break;
            }
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

                        parameters.context.fillStyle = "green";
                        parameters.context.fillText(
                            "" + staticComp.rotation,
                            staticComp.origin.x * globalConfig.tileSize +
                                globalConfig.tileSize -
                                2.5 * String(staticComp.rotation).length -
                                2.5,
                            staticComp.origin.y * globalConfig.tileSize + 5
                        );

                        parameters.context.fillStyle = "blue";
                        parameters.context.fillText(
                            "" + entity.components.Pipe.currentAmount,
                            staticComp.origin.x * globalConfig.tileSize,
                            staticComp.origin.y * globalConfig.tileSize + globalConfig.tileSize
                        );

                        parameters.context.fillStyle = "black";
                        parameters.context.fillText(
                            "" + entity.components.Pipe.currentPressure,
                            staticComp.origin.x * globalConfig.tileSize +
                                globalConfig.tileSize -
                                2.5 * String(entity.components.Pipe.currentPressure).length -
                                2.5,
                            staticComp.origin.y * globalConfig.tileSize + globalConfig.tileSize
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

            for (let i = 0; i < contents.length; ++i) {
                const entity = contents[i];
                if (entity.components.Pipe) {
                    // DEBUG Rendering
                    if (G_IS_DEV && globalConfig.debug.renderPipeRotations) {
                        const connection = entity.components.Pipe.connections;
                        const origin = entity.components.StaticMapEntity.origin;

                        if (connection.length > 1) {
                            parameters.context.fillStyle = "green";
                        } else {
                            parameters.context.fillStyle = "red";
                        }

                        const w = 10;
                        parameters.context.fillRect(
                            origin.x * globalConfig.tileSize + globalConfig.tileSize / 2 - w / 2,
                            origin.y * globalConfig.tileSize + globalConfig.tileSize / 2 - w / 2,
                            w,
                            w
                        );
                    }
                }
            }
        }
    }
}
