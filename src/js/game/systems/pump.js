import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { enumDirectionToVector } from "../../core/vector";
import { BaseItem } from "../base_item";
import { MetaPumpBuilding } from "../buildings/pump";
import { PumpComponent } from "../components/pump";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { enumFluids, FLUID_ITEM_SINGLETONS } from "../items/fluid_item";
import { MapChunkView } from "../map_chunk_view";

export class PumpSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [PumpComponent]);

        this.needsRecompute = true;
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const pumpComp = entity.components.Pump;

            // // Reset everything on recompute
            // if (this.needsRecompute) {
            //     pumpComp.cachedChainedPump = null;
            // }

            // Check if pump is above an actual tile
            if (!pumpComp.cachedPumpedFluid) {
                const staticComp = entity.components.StaticMapEntity;
                let tileBelow = this.root.map.getLowerLayerContentXY(
                    staticComp.origin.x,
                    staticComp.origin.y
                );

                if (!tileBelow) {
                    continue;
                }

                if (!(tileBelow instanceof BaseItem)) {
                    const fakeTile = tileBelow.item;
                    if (fakeTile instanceof BaseItem) {
                        tileBelow = fakeTile;
                    } else {
                        continue;
                    }
                }

                pumpComp.cachedPumpedFluid = tileBelow;
            }

            // First, try to get rid of chained fluids
            if (pumpComp.fluidChainBuffer.length > 0) {
                if (this.tryPerformPumpEject(entity, pumpComp.fluidChainBuffer[0])) {
                    pumpComp.fluidChainBuffer.shift();
                    continue;
                }
            }

            if (this.tryPerformPumpEject(entity, pumpComp.cachedPumpedFluid)) {
                // Analytics hook
                this.root.signals.itemProduced.dispatch(pumpComp.cachedPumpedFluid);
            }
        }

        // After this frame we are done
        this.needsRecompute = false;
    }

    /**
     * Finds the target chained pump for a given entity
     * @param {Entity} entity
     * @returns {Entity|false} The chained entity or null if not found
     */
    findChainedPump(entity) {
        const ejectComp = entity.components.FluidEjector;
        const staticComp = entity.components.StaticMapEntity;
        const contentsBelow = this.root.map.getLowerLayerContentXY(staticComp.origin.x, staticComp.origin.y);
        if (!contentsBelow) {
            // This pump has no contents
            return null;
        }

        const ejectingSlot = ejectComp.slots[0];
        const ejectingPos = staticComp.localTileToWorld(ejectingSlot.pos);
        const ejectingDirection = staticComp.localDirectionToWorld(ejectingSlot.direction);

        const targetTile = ejectingPos.add(enumDirectionToVector[ejectingDirection]);
        const targetContents = this.root.map.getTileContent(targetTile, "regular");

        // Check if we are connected to another pump and thus do not eject directly
        if (targetContents) {
            const targetPumpComp = targetContents.components.Pump;
            if (targetPumpComp && targetPumpComp.chainable) {
                const targetLowerLayer = this.root.map.getLowerLayerContentXY(targetTile.x, targetTile.y);
                if (targetLowerLayer) {
                    return targetContents;
                }
            }
        }

        return false;
    }

    /**
     *
     * @param {Entity} entity
     * @param {BaseItem} fluid
     */
    tryPerformPumpEject(entity, fluid) {
        const pumpComp = entity.components.Pump;
        const ejectComp = entity.components.FluidEjector;

        // Check if we are a chained pump
        if (pumpComp.chainable) {
            const targetEntity = pumpComp.cachedChainedPump;

            // Check if the cache has to get recomputed
            if (targetEntity === null) {
                pumpComp.cachedChainedPump = this.findChainedPump(entity);
            }

            // Check if we now have a target
            if (targetEntity) {
                const targetPumpComp = targetEntity.components.Pump;
                if (targetPumpComp.tryAcceptChainedFluid(fluid)) {
                    return true;
                } else {
                    return false;
                }
            }
        }

        // Seems we are a regular pump or at the end of a row, try actually ejecting
        if (ejectComp.tryEject(0, fluid)) {
            return true;
        }

        return false;
    }

    /**
     *
     * @param {DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;

        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const pumpComp = entity.components.Pump;
            if (!pumpComp) {
                continue;
            }

            const staticComp = entity.components.StaticMapEntity;
            if (!pumpComp.cachedPumpedFluid) {
                continue;
            }

            // Draw the fluid background - this is to hide the ejected fluid animation from
            // the fluid ejector

            const padding = 3;
            const destX = staticComp.origin.x * globalConfig.tileSize + padding;
            const destY = staticComp.origin.y * globalConfig.tileSize + padding;
            const dimensions = globalConfig.tileSize - 2 * padding;

            if (parameters.visibleRect.containsRect4Params(destX, destY, dimensions, dimensions)) {
                parameters.context.fillStyle = pumpComp.cachedPumpedFluid.getBackgroundColorAsResource();
                parameters.context.fillRect(destX, destY, dimensions, dimensions);
            }

            pumpComp.cachedPumpedFluid.drawItemCenteredClipped(
                (0.5 + staticComp.origin.x) * globalConfig.tileSize,
                (0.5 + staticComp.origin.y) * globalConfig.tileSize,
                parameters,
                globalConfig.defaultFluidDiameter
            );
        }
    }
}
