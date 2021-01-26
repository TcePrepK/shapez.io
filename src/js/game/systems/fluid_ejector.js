import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { createLogger } from "../../core/logging";
import { Rectangle } from "../../core/rectangle";
import { StaleAreaDetector } from "../../core/stale_area_detector";
import { enumDirection, enumDirectionToVector } from "../../core/vector";
import { BaseItem } from "../base_item";
import { PipeComponent } from "../components/pipe";
import { FluidAcceptorComponent } from "../components/fluid_acceptor";
import { FluidEjectorComponent } from "../components/fluid_ejector";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";

const logger = createLogger("systems/ejector");

export class FluidEjectorSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [FluidEjectorComponent]);

        this.staleAreaDetector = new StaleAreaDetector({
            root: this.root,
            name: "fluid-ejector",
            recomputeMethod: this.recomputeArea.bind(this),
        });

        this.staleAreaDetector.recomputeOnComponentsChanged(
            [FluidEjectorComponent, FluidAcceptorComponent, PipeComponent],
            1
        );

        this.root.signals.postLoadHook.add(this.recomputeCacheFull, this);
    }

    /**
     * Recomputes an area after it changed
     * @param {Rectangle} area
     */
    recomputeArea(area) {
        /** @type {Set<number>} */
        const seenUids = new Set();
        for (let x = 0; x < area.w; ++x) {
            for (let y = 0; y < area.h; ++y) {
                const tileX = area.x + x;
                const tileY = area.y + y;
                // @NOTICE: Fluid ejector currently only supports regular layer
                const contents = this.root.map.getLayerContentXY(tileX, tileY, "regular");
                if (contents && contents.components.FluidEjector) {
                    if (!seenUids.has(contents.uid)) {
                        seenUids.add(contents.uid);
                        this.recomputeSingleEntityCache(contents);
                    }
                }
            }
        }
    }

    /**
     * Recomputes the whole cache after the game has loaded
     */
    recomputeCacheFull() {
        logger.log("Full cache recompute in post load hook");
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            this.recomputeSingleEntityCache(entity);
        }
    }

    /**
     * @param {Entity} entity
     */
    recomputeSingleEntityCache(entity) {
        const ejectorComp = entity.components.FluidEjector;
        const staticComp = entity.components.StaticMapEntity;

        for (let slotIndex = 0; slotIndex < ejectorComp.slots.length; ++slotIndex) {
            const ejectorSlot = ejectorComp.slots[slotIndex];

            // Clear the old cache.
            ejectorSlot.cachedDestSlot = null;
            ejectorSlot.cachedTargetEntity = null;
            ejectorSlot.cachedPipePath = null;

            // Figure out where and into which direction we eject fluids
            const ejectSlotWsTile = staticComp.localTileToWorld(ejectorSlot.pos);
            const ejectSlotWsDirection = staticComp.localDirectionToWorld(ejectorSlot.direction);
            const ejectSlotWsDirectionVector = enumDirectionToVector[ejectSlotWsDirection];
            const ejectSlotTargetWsTile = ejectSlotWsTile.add(ejectSlotWsDirectionVector);

            // Try to find the given acceptor component to take the fluid
            // Since there can be cross layer dependencies, check on all layers
            const targetEntities = this.root.map.getLayersContentsMultipleXY(
                ejectSlotTargetWsTile.x,
                ejectSlotTargetWsTile.y
            );

            for (let i = 0; i < targetEntities.length; ++i) {
                const targetEntity = targetEntities[i];

                const targetStaticComp = targetEntity.components.StaticMapEntity;
                const targetPipeComp = targetEntity.components.Pipe;

                // Check for pipes (special case)
                if (targetPipeComp) {
                    const pipeAcceptingDirection = targetStaticComp.localDirectionToWorld(enumDirection.top);
                    if (ejectSlotWsDirection === pipeAcceptingDirection) {
                        ejectorSlot.cachedTargetEntity = targetEntity;
                        ejectorSlot.cachedPipePath = targetPipeComp.assignedPath;
                        break;
                    }
                }

                // Check for fluid acceptors
                const targetAcceptorComp = targetEntity.components.FluidAcceptor;
                if (!targetAcceptorComp) {
                    // Entity doesn't accept fluids
                    continue;
                }

                const matchingSlot = targetAcceptorComp.findMatchingSlot(
                    targetStaticComp.worldToLocalTile(ejectSlotTargetWsTile),
                    targetStaticComp.worldDirectionToLocal(ejectSlotWsDirection)
                );

                if (!matchingSlot) {
                    // No matching slot found
                    continue;
                }

                // A slot can always be connected to one other slot only
                ejectorSlot.cachedTargetEntity = targetEntity;
                ejectorSlot.cachedDestSlot = matchingSlot;
                break;
            }
        }
    }

    update() {
        this.staleAreaDetector.update();

        // Precompute effective pipe speed
        let progressGrowth = 2 * this.root.dynamicTickrate.deltaSeconds;

        if (G_IS_DEV && globalConfig.debug.instantPipes) {
            progressGrowth = 1;
        }

        // Go over all cache entries
        for (let i = 0; i < this.allEntities.length; ++i) {
            const sourceEntity = this.allEntities[i];
            const sourceEjectorComp = sourceEntity.components.FluidEjector;

            const slots = sourceEjectorComp.slots;
            for (let j = 0; j < slots.length; ++j) {
                const sourceSlot = slots[j];
                const fluid = sourceSlot.fluid;
                if (!fluid) {
                    // No fluid available to be ejected
                    continue;
                }

                // Advance fluids on the slot
                sourceSlot.progress = Math.min(
                    1,
                    sourceSlot.progress +
                        progressGrowth *
                            this.root.hubGoals.getMinerBaseSpeed() *
                            globalConfig.fluidSpacingOnPipes
                );

                if (G_IS_DEV && globalConfig.debug.disableEjectorProcessing) {
                    sourceSlot.progress = 1.0;
                }

                // Check if we are still in the process of ejecting, can't proceed then
                if (sourceSlot.progress < 1.0) {
                    continue;
                }

                // Check if we are ejecting to a pipe path
                const destPath = sourceSlot.cachedPipePath;
                if (destPath) {
                    // Try passing the fluid over
                    if (destPath.tryAcceptFluid(fluid)) {
                        sourceSlot.fluid = null;
                    }

                    // Always stop here, since there can *either* be a pipe path *or*
                    // a slot
                    continue;
                }

                // Check if the target acceptor can actually accept this fluid
                const destEntity = sourceSlot.cachedTargetEntity;
                const destSlot = sourceSlot.cachedDestSlot;
                if (destSlot) {
                    const targetAcceptorComp = destEntity.components.FluidAcceptor;
                    if (!targetAcceptorComp.canAcceptFluid(destSlot.index, fluid)) {
                        continue;
                    }

                    // Try to hand over the fluid
                    if (this.tryPassOverFluid(fluid, destEntity, destSlot.index)) {
                        // Handover successful, clear slot
                        if (!this.root.app.settings.getAllSettings().simplifiedBelts) {
                            targetAcceptorComp.onFluidAccepted(
                                destSlot.index,
                                destSlot.acceptedDirection,
                                fluid
                            );
                        }
                        sourceSlot.fluid = null;
                        continue;
                    }
                }
            }
        }
    }

    /**
     *
     * @param {BaseItem} fluid
     * @param {Entity} receiver
     * @param {number} slotIndex
     */
    tryPassOverFluid(fluid, receiver, slotIndex) {
        // Try figuring out how what to do with the fluid
        // @TODO: Kinda hacky. How to solve this properly? Don't want to go through inheritance hell.

        // const pipeComp = receiver.components.Pipe;
        // if (pipeComp) {
        //     const path = pipeComp.assignedPath;
        //     assert(path, "pipe has no path");
        //     if (path.tryAcceptFluid(fluid)) {
        //         return true;
        //     }
        //     // Pipe can have nothing else
        //     return false;
        // }

        // const fluidProcessorComp = receiver.components.FluidProcessor;
        // if (fluidProcessorComp) {
        //     // Check for potential filters
        //     if (!this.root.systemMgr.systems.fluidProcessor.checkRequirements(receiver, fluid, slotIndex)) {
        //         return false;
        //     }

        //     // Its an fluid processor ..
        //     if (fluidProcessorComp.tryTakeFluid(fluid, slotIndex)) {
        //         return true;
        //     }
        //     // Fluid processor can have nothing else
        //     return false;
        // }

        // const undergroundPipeComp = receiver.components.UndergroundPipe;
        // if (undergroundPipeComp) {
        //     // Its an underground pipe. yay.
        //     if (
        //         undergroundPipeComp.tryAcceptExternalFluid(
        //             fluid,
        //             this.root.hubGoals.getUndergroundPipeBaseSpeed()
        //         )
        //     ) {
        //         return true;
        //     }

        //     // Underground pipe can have nothing else
        //     return false;
        // }

        // const storageComp = receiver.components.Storage;
        // if (storageComp) {
        //     // It's a storage
        //     if (storageComp.canAcceptFluid(fluid)) {
        //         storageComp.takeFluid(fluid);
        //         return true;
        //     }

        //     // Storage can't have anything else
        //     return false;
        // }

        // const filterComp = receiver.components.Filter;
        // if (filterComp) {
        //     // It's a filter! Unfortunately the filter has to know a lot about it's
        //     // surrounding state and components, so it can't be within the component itself.
        //     if (this.root.systemMgr.systems.filter.tryAcceptFluid(receiver, slotIndex, fluid)) {
        //         return true;
        //     }
        // }

        return false;
    }

    /**
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        if (this.root.app.settings.getAllSettings().simplifiedBelts) {
            // Disabled in potato mode
            return;
        }

        const contents = chunk.containedEntitiesByLayer.regular;

        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const ejectorComp = entity.components.FluidEjector;
            if (!ejectorComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;

            for (let i = 0; i < ejectorComp.slots.length; ++i) {
                const slot = ejectorComp.slots[i];
                const ejectedFluid = slot.fluid;

                if (!ejectedFluid) {
                    // No fluid
                    continue;
                }

                if (!ejectorComp.renderFloatingFluids && !slot.cachedTargetEntity) {
                    // Not connected to any building
                    continue;
                }

                // Limit the progress to the maximum available space on the next pipe (also see #1000)
                let progress = slot.progress;
                const nextPipePath = slot.cachedPipePath;
                if (nextPipePath) {
                    /*
                    If you imagine the track between the center of the building and the center of the first pipe as
                    a range from 0 to 1:1

                           Building              Pipe
                    |         X         |         X         |
                    |         0...................1         |

                    And for example the first fluid on pipe has a distance of 0.4 to the beginning of the pipe:

                           Building              Pipe
                    |         X         |         X         |
                    |         0...................1         |
                                               ^ fluid

                    Then the space towards this first fluid is always 0.5 (the distance from the center of the building to the beginning of the pipe)
                    PLUS the spacing to the fluid, so in this case 0.5 + 0.4 = 0.9:

                    Building              Pipe
                    |         X         |         X         |
                    |         0...................1         |
                                               ^ fluid @ 0.9

                    Since fluids must not get clashed, we need to substract some spacing (lets assume it is 0.6, exact value see globalConfig.fluidSpacingOnPipes),
                    So we do 0.9 - globalConfig.fluidSpacingOnPipes = 0.3

                    Building              Pipe
                    |         X         |         X         |
                    |         0...................1         |
                                    ^           ^ fluid @ 0.9
                                    ^ max progress = 0.3

                    Because now our range actually only goes to the end of the building, and not towards the center of the building, we need to multiply
                    all values by 2:

                    Building              Pipe
                    |         X         |         X         |
                    |         0.........1.........2         |
                                    ^           ^ fluid @ 1.8
                                    ^ max progress = 0.6

                    And that's it! If you summarize the calculations from above into a formula, you get the one below.
                    */

                    const maxProgress =
                        (0.5 + nextPipePath.spacingToFirstFluid - globalConfig.fluidSpacingOnPipes) * 2;
                    progress = Math.min(maxProgress, progress);
                }

                // Skip if the fluid would barely be visible
                if (progress < 0.05) {
                    continue;
                }

                const realPosition = staticComp.localTileToWorld(slot.pos);
                if (!chunk.tileSpaceRectangle.containsPoint(realPosition.x, realPosition.y)) {
                    // Not within this chunk
                    continue;
                }

                const realDirection = staticComp.localDirectionToWorld(slot.direction);
                const realDirectionVector = enumDirectionToVector[realDirection];

                const tileX = realPosition.x + 0.5 + realDirectionVector.x * 0.5 * progress;
                const tileY = realPosition.y + 0.5 + realDirectionVector.y * 0.5 * progress;

                const worldX = tileX * globalConfig.tileSize;
                const worldY = tileY * globalConfig.tileSize;

                ejectedFluid.drawItemCenteredClipped(
                    worldX,
                    worldY,
                    parameters,
                    globalConfig.defaultFluidDiameter
                );
            }
        }
    }
}
