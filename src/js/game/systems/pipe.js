import { globalConfig } from "../../core/config";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Loader } from "../../core/loader";
import { createLogger } from "../../core/logging";
import { Rectangle } from "../../core/rectangle";
import { AtlasSprite } from "../../core/sprites";
import { StaleAreaDetector } from "../../core/stale_area_detector";
import { fastArrayDeleteValueIfContained } from "../../core/utils";
import {
    arrayAllDirections,
    enumDirection,
    enumDirectionToVector,
    enumInvertedDirections,
    Vector,
} from "../../core/vector";
import { BaseItem } from "../base_item";
import { arrayPipeRotationVariantToType, MetaPipeBuilding } from "../buildings/pipe";
import { getCodeFromBuildingData } from "../building_codes";
import { enumPipeType, enumPipeVariant, PipeComponent } from "../components/pipe";
import { enumPinSlotType, FluidPinsComponent } from "../components/fluid_pins";
import { PipeTunnelComponent } from "../components/pipe_tunnel";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { isTruthyItem } from "../items/boolean_item";
import { MapChunkView } from "../map_chunk_view";
import { drawSpriteClipped } from "../../core/draw_utils";

const logger = createLogger("pipes");

let networkUidCounter = 0;

const VERBOSE_WIRES = G_IS_DEV && false;

export class PipeNetwork {
    constructor() {
        /**
         * Who contributes to this network
         * @type {Array<{ entity: Entity, slot: import("../components/fluid_pins").FluidPinSlot }>} */
        this.providers = [];

        /**
         * Who takes values from this network
         * @type {Array<{ entity: Entity, slot: import("../components/fluid_pins").FluidPinSlot }>} */
        this.receivers = [];

        /**
         * All connected slots
         * @type {Array<{ entity: Entity, slot: import("../components/fluid_pins").FluidPinSlot }>}
         */
        this.allSlots = [];

        /**
         * All connected tunnels
         * @type {Array<Entity>}
         */
        this.tunnels = [];

        /**
         * Which pipes are in this network
         * @type {Array<Entity>}
         */
        this.pipes = [];

        /**
         * The current value of this network
         * @type {BaseItem}
         */
        this.currentValue = null;

        /**
         * The current value of this network
         * @type {number}
         */
        this.currentAmount = 0;

        /**
         * Unique network identifier
         * @type {number}
         */
        this.uid = ++networkUidCounter;
    }

    /**
     * Returns whether this network currently has a value
     * @returns {boolean}
     */
    hasValue() {
        return !!this.currentValue;
    }
}

export class PipeSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [PipeComponent]);

        /**
         * @type {Object<enumPipeVariant, Object<enumPipeType, AtlasSprite>}
         */
        this.pipeSprites = {};
        const variants = ["industrial", ...Object.keys(enumPipeVariant)];
        for (let i = 0; i < variants.length; ++i) {
            const pipeVariant = variants[i];
            const sprites = {};
            for (const pipeType in enumPipeType) {
                sprites[pipeType] = Loader.getSprite(
                    "sprites/pipes/" + pipeVariant + "_" + pipeType + ".png"
                );
            }
            this.pipeSprites[pipeVariant] = sprites;
        }

        this.root.signals.entityDestroyed.add(this.queuePlacementUpdate, this);
        this.root.signals.entityAdded.add(this.queuePlacementUpdate, this);

        this.root.signals.entityDestroyed.add(this.queueRecomputeIfPipe, this);
        this.root.signals.entityChanged.add(this.queueRecomputeIfPipe, this);
        this.root.signals.entityAdded.add(this.queueRecomputeIfPipe, this);

        this.needsRecompute = true;
        this.isFirstRecompute = true;

        this.staleArea = new StaleAreaDetector({
            root: this.root,
            name: "pipes",
            recomputeMethod: this.updateSurroundingPipePlacement.bind(this),
        });

        /**
         * @type {Array<PipeNetwork>}
         */
        this.networks = [];
    }

    /**
     * Invalidates the pipes network if the given entity is relevant for it
     * @param {Entity} entity
     */
    queueRecomputeIfPipe(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (this.isEntityRelevantForPipes(entity)) {
            this.needsRecompute = true;
            this.networks = [];
        }
    }

    /**
     * Recomputes the whole pipes network
     */
    recomputePipesNetwork() {
        this.needsRecompute = false;
        logger.log("Recomputing pipes network");

        this.networks = [];

        const pipeEntities = this.root.entityMgr.getAllWithComponent(PipeComponent);
        const tunnelEntities = this.root.entityMgr.getAllWithComponent(PipeTunnelComponent);
        const pinEntities = this.root.entityMgr.getAllWithComponent(FluidPinsComponent);

        // Clear all network references, but not on the first update since that's the deserializing one
        if (!this.isFirstRecompute) {
            for (let i = 0; i < pipeEntities.length; ++i) {
                pipeEntities[i].components.Pipe.linkedNetwork = null;
            }
            for (let i = 0; i < tunnelEntities.length; ++i) {
                tunnelEntities[i].components.PipeTunnel.linkedNetworks = [];
            }

            for (let i = 0; i < pinEntities.length; ++i) {
                const slots = pinEntities[i].components.FluidPins.slots;
                for (let k = 0; k < slots.length; ++k) {
                    slots[k].linkedNetwork = null;
                }
            }
        } else {
            logger.log("Recomputing pipes first time");
            this.isFirstRecompute = false;
        }

        VERBOSE_WIRES && logger.log("Recomputing slots");

        // Iterate over all ejector slots
        for (let i = 0; i < pinEntities.length; ++i) {
            const entity = pinEntities[i];
            const slots = entity.components.FluidPins.slots;
            for (let k = 0; k < slots.length; ++k) {
                const slot = slots[k];

                // Ejectors are computed directly, acceptors are just set
                if (slot.type === enumPinSlotType.fluidEjector && !slot.linkedNetwork) {
                    this.findNetworkForEjector(entity, slot);
                }
            }
        }
    }

    /**
     * Finds the network for the given slot
     * @param {Entity} initialEntity
     * @param {import("../components/fluid_pins").FluidPinSlot} slot
     */
    findNetworkForEjector(initialEntity, slot) {
        let currentNetwork = new PipeNetwork();
        VERBOSE_WIRES &&
            logger.log(
                "Finding network for entity",
                initialEntity.uid,
                initialEntity.components.StaticMapEntity.origin.toString(),
                "(nw-id:",
                currentNetwork.uid,
                ")"
            );
        const entitiesToVisit = [
            {
                entity: initialEntity,
                slot,
            },
        ];
        /**
         * Once we occur a wire, we store its variant so we don't connect to
         * mismatching ones
         * @type {enumPipeVariant}
         */
        let variantMask = null;
        while (entitiesToVisit.length > 0) {
            const nextData = entitiesToVisit.pop();
            const nextEntity = nextData.entity;

            const pipeComp = nextEntity.components.Pipe;
            const staticComp = nextEntity.components.StaticMapEntity;

            VERBOSE_WIRES && logger.log("Visiting", staticComp.origin.toString(), "(", nextEntity.uid, ")");

            // Where to search for neighbours
            let newSearchDirections = [];
            let newSearchTile = null;

            //// WIRE
            if (pipeComp) {
                // Sanity check
                assert(
                    !pipeComp.linkedNetwork || pipeComp.linkedNetwork === currentNetwork,
                    "Mismatching pipe network on pipe entity " +
                        (pipeComp.linkedNetwork ? pipeComp.linkedNetwork.uid : "<empty>") +
                        " vs " +
                        currentNetwork.uid +
                        " @ " +
                        staticComp.origin.toString()
                );

                if (!pipeComp.linkedNetwork) {
                    if (variantMask && pipeComp.variant !== variantMask) {
                        // Mismatching variant
                    } else {
                        // This one is new! :D
                        VERBOSE_WIRES && logger.log("  Visited new pipe:", staticComp.origin.toString());
                        pipeComp.linkedNetwork = currentNetwork;
                        currentNetwork.pipes.push(nextEntity);

                        newSearchDirections = arrayAllDirections;
                        newSearchTile = nextEntity.components.StaticMapEntity.origin;
                        variantMask = pipeComp.variant;
                    }
                }
            }

            //// PINS
            const pinsComp = nextEntity.components.FluidPins;
            if (pinsComp) {
                const slot = nextData.slot;
                assert(slot, "No slot set for next entity");

                if (slot.type === enumPinSlotType.fluidEjector) {
                    VERBOSE_WIRES &&
                        logger.log("  Visiting ejector slot", staticComp.origin.toString(), "->", slot.type);
                } else if (slot.type === enumPinSlotType.fluidAcceptor) {
                    VERBOSE_WIRES &&
                        logger.log("  Visiting acceptor slot", staticComp.origin.toString(), "->", slot.type);
                } else {
                    assertAlways(false, "Bad slot type: " + slot.type);
                }

                // Sanity check
                assert(
                    !slot.linkedNetwork || slot.linkedNetwork === currentNetwork,
                    "Mismatching pipe network on pin slot entity " +
                        (slot.linkedNetwork ? slot.linkedNetwork.uid : "<empty>") +
                        " vs " +
                        currentNetwork.uid
                );
                if (!slot.linkedNetwork) {
                    // This one is new
                    VERBOSE_WIRES && logger.log("  Visited new slot:", staticComp.origin.toString());

                    // Add to the right list
                    if (slot.type === enumPinSlotType.fluidEjector) {
                        currentNetwork.providers.push({ entity: nextEntity, slot });
                    } else if (slot.type === enumPinSlotType.fluidAcceptor) {
                        currentNetwork.receivers.push({ entity: nextEntity, slot });
                    } else {
                        assertAlways(false, "unknown slot type:" + slot.type);
                    }

                    // Register on the network
                    currentNetwork.allSlots.push({ entity: nextEntity, slot });
                    slot.linkedNetwork = currentNetwork;

                    // Specify where to search next
                    newSearchDirections = [staticComp.localDirectionToWorld(slot.direction)];
                    newSearchTile = staticComp.localTileToWorld(slot.pos);
                }
            }

            if (newSearchTile) {
                // Find new surrounding pipe targets
                const newTargets = this.findSurroundingPipeTargets(
                    newSearchTile,
                    newSearchDirections,
                    currentNetwork
                );

                VERBOSE_WIRES && logger.log("   Found", newTargets, "new targets to visit!");
                for (let i = 0; i < newTargets.length; ++i) {
                    entitiesToVisit.push(newTargets[i]);
                }
            }
        }

        if (
            currentNetwork.providers.length > 0 &&
            (currentNetwork.pipes.length > 0 ||
                currentNetwork.receivers.length > 0 ||
                currentNetwork.tunnels.length > 0)
        ) {
            this.networks.push(currentNetwork);
            VERBOSE_WIRES && logger.log("Attached new network with uid", currentNetwork);
        } else {
            // Unregister network again
            for (let i = 0; i < currentNetwork.pipes.length; ++i) {
                currentNetwork.pipes[i].components.Pipe.linkedNetwork = null;
            }

            for (let i = 0; i < currentNetwork.tunnels.length; ++i) {
                fastArrayDeleteValueIfContained(
                    currentNetwork.tunnels[i].components.PipeTunnel.linkedNetworks,
                    currentNetwork
                );
            }

            for (let i = 0; i < currentNetwork.allSlots.length; ++i) {
                currentNetwork.allSlots[i].slot.linkedNetwork = null;
            }
        }
    }

    /**
     * Finds surrounding entities which are not yet assigned to a network
     * @param {Vector} initialTile
     * @param {Array<enumDirection>} directions
     * @param {PipeNetwork} network
     * @param {enumPipeVariant=} variantMask Only accept connections to this mask
     * @returns {Array<any>}
     */
    findSurroundingPipeTargets(initialTile, directions, network, variantMask = null) {
        let result = [];

        VERBOSE_WIRES &&
            logger.log(
                "    Searching for new targets at",
                initialTile.toString(),
                "and d=",
                directions,
                "with mask=",
                variantMask
            );

        // Go over all directions we should search for
        for (let i = 0; i < directions.length; ++i) {
            const direction = directions[i];
            const offset = enumDirectionToVector[direction];
            const initialSearchTile = initialTile.add(offset);

            // Store which tunnels we already visited to avoid infinite loops
            const visitedTunnels = new Set();

            // First, find the initial connected entities
            const initialContents = this.root.map.getLayersContentsMultipleXY(
                initialSearchTile.x,
                initialSearchTile.y
            );

            // Link the initial tile to the initial entities, since it may change
            /** @type {Array<{entity: Entity, tile: Vector}>} */
            const contents = [];
            for (let j = 0; j < initialContents.length; ++j) {
                contents.push({
                    entity: initialContents[j],
                    tile: initialSearchTile,
                });
            }

            for (let k = 0; k < contents.length; ++k) {
                const { entity, tile } = contents[k];
                const pipeComp = entity.components.Pipe;

                // Check for pipe
                // Check for wire
                if (
                    pipeComp &&
                    !pipeComp.linkedNetwork &&
                    (!variantMask || pipeComp.variant === variantMask)
                ) {
                    // Wires accept connections from everywhere
                    result.push({
                        entity,
                    });
                }

                // Check for connected slots
                const pinComp = entity.components.FluidPins;
                if (pinComp) {
                    const staticComp = entity.components.StaticMapEntity;

                    // Go over all slots and see if they are connected
                    const pinSlots = pinComp.slots;
                    for (let j = 0; j < pinSlots.length; ++j) {
                        const slot = pinSlots[j];

                        // Check if the position matches
                        const pinPos = staticComp.localTileToWorld(slot.pos);
                        if (!pinPos.equals(tile)) {
                            continue;
                        }

                        // Check if the direction (inverted) matches
                        const pinDirection = staticComp.localDirectionToWorld(slot.direction);
                        if (pinDirection !== enumInvertedDirections[direction]) {
                            continue;
                        }

                        if (!slot.linkedNetwork) {
                            result.push({
                                entity,
                                slot,
                            });
                        }
                    }

                    // Pin slots mean it can be nothing else
                    continue;
                }

                // Check if it's a tunnel, if so, go to the forwarded item
                const tunnelComp = entity.components.PipeTunnel;
                if (tunnelComp) {
                    if (visitedTunnels.has(entity.uid)) {
                        continue;
                    }

                    const staticComp = entity.components.StaticMapEntity;

                    // Compute where this tunnel connects to
                    const forwardedTile = staticComp.origin.add(offset);
                    VERBOSE_WIRES &&
                        logger.log(
                            "   Found tunnel",
                            entity.uid,
                            "at",
                            tile,
                            "-> forwarding to",
                            forwardedTile
                        );

                    // Figure out which entities are connected
                    const connectedContents = this.root.map.getLayersContentsMultipleXY(
                        forwardedTile.x,
                        forwardedTile.y
                    );

                    // Attach the entities and the tile we search at, because it may change
                    for (let h = 0; h < connectedContents.length; ++h) {
                        contents.push({
                            entity: connectedContents[h],
                            tile: forwardedTile,
                        });
                    }

                    // Add the tunnel to the network
                    if (tunnelComp.linkedNetworks.indexOf(network) < 0) {
                        tunnelComp.linkedNetworks.push(network);
                    }
                    if (network.tunnels.indexOf(entity) < 0) {
                        network.tunnels.push(entity);
                    }

                    // Remember this tunnel
                    visitedTunnels.add(entity.uid);
                }
            }
        }

        VERBOSE_WIRES && logger.log("     -> Found", result.length);

        return result;
    }

    /**
     * Updates the pipes network
     */
    update() {
        this.staleArea.update();

        if (this.needsRecompute) {
            this.recomputePipesNetwork();
        }

        // Re-compute values of all networks
        for (let i = 0; i < this.networks.length; ++i) {
            const network = this.networks[i];

            // Aggregate values of all senders
            const senders = network.providers;
            let value = null;
            for (let k = 0; k < senders.length; ++k) {
                const senderSlot = senders[k];
                const slotValue = senderSlot.slot.value;

                // The first sender can just put in his value
                if (!value) {
                    value = slotValue;
                    continue;
                }

                // If the slot is empty itself, just skip it
                if (!slotValue) {
                    continue;
                }

                // If there is already an value, compare if it matches ->
                // otherwise there is a conflict
                if (value.equals(slotValue)) {
                    // All good
                    continue;
                }

                break;
            }

            network.currentValue = value;
        }
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawChunk(parameters, chunk) {
        const contents = chunk.contents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity && entity.components.Pipe) {
                    const pipeComp = entity.components.Pipe;
                    const pipeType = pipeComp.type;
                    const sprite = this.pipeSprites[pipeType];
                    const staticComp = entity.components.StaticMapEntity;
                    parameters.context.globalAlpha = 1;
                    staticComp.drawSpriteOnBoundsClipped(parameters, sprite, 0);

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

                        if (entity.components.Pipe.linkedNetwork.currentAmount) {
                            parameters.context.fillText(
                                entity.components.Pipe.linkedNetwork.currentAmount,
                                staticComp.origin.x * globalConfig.tileSize,
                                staticComp.origin.y * globalConfig.tileSize + 5
                            );
                        }
                    }
                }

                // DEBUG Rendering
                if (G_IS_DEV && globalConfig.debug.renderPipeNetworkInfos) {
                    if (entity) {
                        const staticComp = entity.components.StaticMapEntity;
                        const pipeComp = entity.components.Pipe;

                        // Draw network info for pipes
                        if (pipeComp && pipeComp.linkedNetwork) {
                            parameters.context.fillStyle = "red";
                            parameters.context.font = "5px Tahoma";
                            parameters.context.fillText(
                                "W" + pipeComp.linkedNetwork.uid,
                                (staticComp.origin.x + 0.5) * globalConfig.tileSize,
                                (staticComp.origin.y + 0.5) * globalConfig.tileSize
                            );
                        }
                    }
                }
            }
        }

        parameters.context.globalAlpha = 1;
    }

    /**
     * Returns whether this entity is relevant for the pipes network
     * @param {Entity} entity
     */
    isEntityRelevantForPipes(entity) {
        return entity.components.Pipe || entity.components.FluidPins || entity.components.PipeTunnel;
    }

    /**
     *
     * @param {Entity} entity
     */
    queuePlacementUpdate(entity) {
        if (!this.root.gameInitialized) {
            return;
        }

        if (!this.isEntityRelevantForPipes(entity)) {
            return;
        }

        const staticComp = entity.components.StaticMapEntity;
        if (!staticComp) {
            return;
        }

        // Invalidate affected area
        const originalRect = staticComp.getTileSpaceBounds();
        const affectedArea = originalRect.expandedInAllDirections(1);
        this.staleArea.invalidate(affectedArea);
    }

    /**
     * Updates the pipe placement after an entity has been added / deleted
     * @param {Rectangle} affectedArea
     */
    updateSurroundingPipePlacement(affectedArea) {
        const metaPipe = gMetaBuildingRegistry.findByClass(MetaPipeBuilding);

        for (let x = affectedArea.x; x < affectedArea.right(); ++x) {
            for (let y = affectedArea.y; y < affectedArea.bottom(); ++y) {
                const targetEntities = this.root.map.getLayersContentsMultipleXY(x, y);
                for (let i = 0; i < targetEntities.length; ++i) {
                    const targetEntity = targetEntities[i];

                    const targetPipeComp = targetEntity.components.Pipe;
                    const targetStaticComp = targetEntity.components.StaticMapEntity;

                    if (!targetPipeComp) {
                        // Not a pipe
                        continue;
                    }

                    const variant = targetStaticComp.getVariant();

                    const {
                        rotation,
                        rotationVariant,
                    } = metaPipe.computeOptimalDirectionAndRotationVariantAtTile({
                        root: this.root,
                        tile: new Vector(x, y),
                        rotation: targetStaticComp.originalRotation,
                        variant,
                        layer: targetEntity.layer,
                    });

                    // Compute delta to see if anything changed
                    const newType = arrayPipeRotationVariantToType[rotationVariant];

                    if (targetStaticComp.rotation !== rotation || newType !== targetPipeComp.type) {
                        // Change stuff
                        targetStaticComp.rotation = rotation;
                        metaPipe.updateVariants(targetEntity, rotationVariant, variant);

                        // Update code as well
                        targetStaticComp.code = getCodeFromBuildingData(metaPipe, variant, rotationVariant);

                        // Make sure the chunks know about the update
                        this.root.signals.entityChanged.dispatch(targetEntity);
                    }
                }
            }
        }
    }
}
