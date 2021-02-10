import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { enumDirectionToVector } from "../../core/vector";
import { BaseItem } from "../base_item";
import { MetaPipeBuilding } from "../buildings/pipe";
import { MetaPumpBuilding } from "../buildings/pump";
import { PumpComponent } from "../components/pump";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { enumFluids, FLUID_ITEM_SINGLETONS } from "../items/fluid_item";
import { MapChunkView } from "../map_chunk_view";

export class PumpSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [PumpComponent]);

        this.pressurePower = 20;

        this.needsRecompute = true;

        this.root.signals.entityAdded.add(this.foundFluid, this);
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];

            const staticComp = entity.components.StaticMapEntity;
            const pumpComp = entity.components.Pump;

            const origin = staticComp.origin;

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

                    if (origin.x - x != 0 && origin.y - y != 0) {
                        // Corners
                        continue;
                    }

                    const targetEntities = this.root.map.getLayersContentsMultipleXY(x, y);
                    for (let i = 0; i < targetEntities.length; ++i) {
                        const targetEntity = targetEntities[i];

                        const pipeComp = targetEntity.components.Pipe;
                        if (!pipeComp) {
                            continue;
                        }

                        if (!pipeComp.currentValue && pumpComp.cachedPumpedFluid) {
                            // @ts-ignore
                            pipeComp.currentValue = FLUID_ITEM_SINGLETONS[pumpComp.cachedPumpedFluid.fluid];
                        }

                        if (!pipeComp.currentValue) {
                            continue;
                        }

                        if (pipeComp.currentAmount < pipeComp.getMaxValue()) {
                            pipeComp.currentAmount += 1;
                        }

                        pipeComp.currentPressure = 20;
                    }
                }
            }
        }

        // After this frame we are done
        this.needsRecompute = false;
    }

    foundFluid(entity) {
        const pumpComp = entity.components.Pump;

        if (!pumpComp) {
            return;
        }

        // Check if miner is above an actual tile
        if (!pumpComp.cachedPumpedFluid) {
            const staticComp = entity.components.StaticMapEntity;
            let tileBelow = this.root.map.getLowerLayerContentXY(staticComp.origin.x, staticComp.origin.y);
            if (!tileBelow) {
                return;
            }

            if (!(tileBelow instanceof BaseItem)) {
                const fakeTile = tileBelow.item;
                if (fakeTile instanceof BaseItem) {
                    tileBelow = fakeTile;
                }
            }

            pumpComp.cachedPumpedFluid = tileBelow;
        }
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
