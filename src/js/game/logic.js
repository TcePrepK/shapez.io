import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { STOP_PROPAGATION } from "../core/signal";
import { round2Digits } from "../core/utils";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../core/vector";
import { getBuildingDataFromCode } from "./building_codes";
import { enumWireVariant } from "./components/wire";
import { Entity } from "./entity";
import { FluidItem } from "./items/fluid_item";
import { CHUNK_OVERLAY_RES } from "./map_chunk_view";
import { MetaBuilding } from "./meta_building";
import { GameRoot } from "./root";
import { WireNetwork } from "./systems/wire";
import { enumPipeVariant } from "./components/pipe";
import { BaseItem } from "./base_item";

const logger = createLogger("ingame/logic");

const VERBOSE_WIRES = G_IS_DEV && false;
const VERBOSE_PIPES = G_IS_DEV && false;

/**
 * Typing helper
 * @typedef {Array<{
 *  entity: Entity,
 *  slot: import("./components/item_ejector").ItemEjectorSlot,
 *  fromTile: Vector,
 *  toDirection: enumDirection
 * }>} EjectorsAffectingTile
 */

/**
 * Typing helper
 * @typedef {Array<{
 *  entity: Entity,
 *  slot: import("./components/item_acceptor").ItemAcceptorSlot,
 *  toTile: Vector,
 *  fromDirection: enumDirection
 * }>} AcceptorsAffectingTile
 */

/**
 * @typedef {{
 *     acceptors: AcceptorsAffectingTile,
 *     ejectors: EjectorsAffectingTile
 * }} AcceptorsAndEjectorsAffectingTile
 */

export class GameLogic {
    /**
     *
     * @param {GameRoot} root
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * Checks if the given entity can be placed
     * @param {Entity} entity
     * @param {Vector=} offset Optional, move the entity by the given offset first
     * @returns {boolean} true if the entity could be placed there
     */
    checkCanPlaceEntity(entity, offset = null) {
        // Compute area of the building
        const rect = entity.components.StaticMapEntity.getTileSpaceBounds();
        if (offset) {
            rect.x += offset.x;
            rect.y += offset.y;
        }

        // Check the whole area of the building
        for (let x = rect.x; x < rect.x + rect.w; ++x) {
            for (let y = rect.y; y < rect.y + rect.h; ++y) {
                // Check if there is any direct collision
                const otherEntity = this.root.map.getLayerContentXY(x, y, entity.layer);
                if (otherEntity) {
                    const metaClass = otherEntity.components.StaticMapEntity.getMetaBuilding();
                    if (!metaClass.getIsReplaceable()) {
                        // This one is a direct blocker
                        return false;
                    }
                }

                // Check if there is any fluid underneath it
                let tile = this.root.map.getLowerLayerContentXY(x, y);
                if (tile && !(tile instanceof BaseItem)) {
                    const fakeTile = tile.item;
                    if (fakeTile instanceof BaseItem) {
                        tile = fakeTile;
                    }
                }

                if (tile && tile instanceof BaseItem && tile.getItemType() === "fluid") {
                    const metaClass = entity.components.StaticMapEntity.getMetaBuilding();
                    if (!metaClass.isPlaceableToFluids(tile.getAsCopyableKey())) {
                        return false;
                    }
                } else {
                    const metaClass = entity.components.StaticMapEntity.getMetaBuilding();

                    if (!metaClass.isPlaceableToGround()) {
                        return false;
                    }
                }
            }
        }

        // Perform additional placement checks
        if (this.root.signals.prePlacementCheck.dispatch(entity, offset) === STOP_PROPAGATION) {
            return false;
        }

        return true;
    }

    /**
     * Attempts to place the given building
     * @param {object} param0
     * @param {Vector} param0.origin
     * @param {number} param0.rotation
     * @param {number} param0.originalRotation
     * @param {number} param0.rotationVariant
     * @param {string} param0.variant
     * @param {MetaBuilding} param0.building
     * @returns {Entity}
     */
    tryPlaceBuilding({ origin, rotation, rotationVariant, originalRotation, variant, building }) {
        const entity = building.createEntity({
            root: this.root,
            origin,
            rotation,
            originalRotation,
            rotationVariant,
            variant,
        });
        if (this.checkCanPlaceEntity(entity)) {
            this.freeEntityAreaBeforeBuild(entity);
            this.root.map.placeStaticEntity(entity);
            this.root.entityMgr.registerEntity(entity);
            return entity;
        }
        return null;
    }

    /**
     * Removes all entities with a RemovableMapEntityComponent which need to get
     * removed before placing this entity
     * @param {Entity} entity
     */
    freeEntityAreaBeforeBuild(entity) {
        const staticComp = entity.components.StaticMapEntity;
        const rect = staticComp.getTileSpaceBounds();
        // Remove any removeable colliding entities on the same layer
        for (let x = rect.x; x < rect.x + rect.w; ++x) {
            for (let y = rect.y; y < rect.y + rect.h; ++y) {
                const contents = this.root.map.getLayerContentXY(x, y, entity.layer);
                if (contents) {
                    assertAlways(
                        contents.components.StaticMapEntity.getMetaBuilding().getIsReplaceable(),
                        "Tried to replace non-repleaceable entity"
                    );
                    if (!this.tryDeleteBuilding(contents)) {
                        assertAlways(false, "Tried to replace non-repleaceable entity #2");
                    }
                }
            }
        }

        // Perform other callbacks
        this.root.signals.freeEntityAreaBeforeBuild.dispatch(entity);
    }

    /**
     * Performs a bulk operation, not updating caches in the meantime
     * @param {function} operation
     */
    performBulkOperation(operation) {
        logger.warn("Running bulk operation ...");
        assert(!this.root.bulkOperationRunning, "Can not run two bulk operations twice");
        this.root.bulkOperationRunning = true;
        const now = performance.now();
        const returnValue = operation();
        const duration = performance.now() - now;
        logger.log("Done in", round2Digits(duration), "ms");
        assert(this.root.bulkOperationRunning, "Bulk operation = false while bulk operation was running");
        this.root.bulkOperationRunning = false;
        this.root.signals.bulkOperationFinished.dispatch();
        return returnValue;
    }

    /**
     * Returns whether the given building can get removed
     * @param {Entity} building
     */
    canDeleteBuilding(building) {
        const staticComp = building.components.StaticMapEntity;
        return staticComp.getMetaBuilding().getIsRemovable();
    }

    /**
     * Tries to delete the given building
     * @param {Entity} building
     */
    tryDeleteBuilding(building) {
        if (!this.canDeleteBuilding(building)) {
            return false;
        }
        this.root.map.removeStaticEntity(building);
        this.root.entityMgr.destroyEntity(building);
        this.root.entityMgr.processDestroyList();
        return true;
    }

    /**
     * Computes the flag for a given tile
     * @param {object} param0
     * @param {enumWireVariant} param0.wireVariant
     * @param {Vector} param0.tile The tile to check at
     * @param {enumDirection} param0.edge The edge to check for
     */
    computeWireEdgeStatus({ wireVariant, tile, edge }) {
        const offset = enumDirectionToVector[edge];
        const targetTile = tile.add(offset);

        // Search for relevant pins
        const pinEntities = this.root.map.getLayersContentsMultipleXY(targetTile.x, targetTile.y);

        // Go over all entities which could have a pin
        for (let i = 0; i < pinEntities.length; ++i) {
            const pinEntity = pinEntities[i];
            const pinComp = pinEntity.components.WiredPins;
            const staticComp = pinEntity.components.StaticMapEntity;

            // Skip those who don't have pins
            if (!pinComp) {
                continue;
            }

            // Go over all pins
            const pins = pinComp.slots;
            for (let k = 0; k < pinComp.slots.length; ++k) {
                const pinSlot = pins[k];
                const pinLocation = staticComp.localTileToWorld(pinSlot.pos);
                const pinDirection = staticComp.localDirectionToWorld(pinSlot.direction);

                // Check if the pin has the right location
                if (!pinLocation.equals(targetTile)) {
                    continue;
                }

                // Check if the pin has the right direction
                if (pinDirection !== enumInvertedDirections[edge]) {
                    continue;
                }

                // Found a pin!
                return true;
            }
        }

        // Now check if there's a connectable entity on the wires layer
        const targetEntity = this.root.map.getTileContent(targetTile, "wires");
        if (!targetEntity) {
            return false;
        }

        const targetStaticComp = targetEntity.components.StaticMapEntity;

        // Check if its a crossing
        const wireTunnelComp = targetEntity.components.WireTunnel;
        if (wireTunnelComp) {
            return true;
        }

        // Check if its a wire
        const wiresComp = targetEntity.components.Wire;
        if (!wiresComp) {
            return false;
        }

        // It's connected if its the same variant
        return wiresComp.variant === wireVariant;
    }

    /**
     * Returns all wire networks this entity participates in on the given tile
     * @param {Entity} entity
     * @param {Vector} tile
     * @returns {Array<WireNetwork>|null} Null if the entity is never able to be connected at the given tile
     */
    getEntityWireNetworks(entity, tile) {
        let canConnectAtAll = false;

        /** @type {Set<WireNetwork>} */
        const networks = new Set();

        const staticComp = entity.components.StaticMapEntity;
        const wireComp = entity.components.Wire;
        if (wireComp) {
            canConnectAtAll = true;
            if (wireComp.linkedNetwork) {
                networks.add(wireComp.linkedNetwork);
            }
        }

        const tunnelComp = entity.components.WireTunnel;
        if (tunnelComp) {
            canConnectAtAll = true;
            for (let i = 0; i < tunnelComp.linkedNetworks.length; ++i) {
                networks.add(tunnelComp.linkedNetworks[i]);
            }
        }

        const pinsComp = entity.components.WiredPins;
        if (pinsComp) {
            const slots = pinsComp.slots;
            for (let i = 0; i < slots.length; ++i) {
                const slot = slots[i];
                const slotLocalPos = staticComp.localTileToWorld(slot.pos);
                if (slotLocalPos.equals(tile)) {
                    canConnectAtAll = true;
                    if (slot.linkedNetwork) {
                        networks.add(slot.linkedNetwork);
                    }
                }
            }
        }

        if (!canConnectAtAll) {
            return null;
        }

        return Array.from(networks);
    }

    /**
     * Returns if the entities tile *and* his overlay matrix is intersected
     * @param {Entity} entity
     * @param {Vector} worldPos
     */
    getIsEntityIntersectedWithMatrix(entity, worldPos) {
        const staticComp = entity.components.StaticMapEntity;
        const tile = worldPos.toTileSpace();

        if (!staticComp.getTileSpaceBounds().containsPoint(tile.x, tile.y)) {
            // No intersection at all
            return;
        }

        const data = getBuildingDataFromCode(staticComp.code);
        const overlayMatrix = data.metaInstance.getSpecialOverlayRenderMatrix(
            staticComp.rotation,
            data.rotationVariant,
            data.variant,
            entity
        );
        // Always the same
        if (!overlayMatrix) {
            return true;
        }

        const localPosition = worldPos
            .divideScalar(globalConfig.tileSize)
            .modScalar(1)
            .multiplyScalar(CHUNK_OVERLAY_RES)
            .floor();

        return !!overlayMatrix[localPosition.x + localPosition.y * 3];
    }

    g(tile, edge) {}

    /**
     * Returns the acceptors and ejectors which affect the current tile
     * @param {Vector} tile
     * @returns {AcceptorsAndEjectorsAffectingTile}
     */
    getEjectorsAndAcceptorsAtTile(tile) {
        /** @type {EjectorsAffectingTile} */
        let ejectors = [];
        /** @type {AcceptorsAffectingTile} */
        let acceptors = [];

        // Well .. please ignore this code! :D
        for (let dx = -1; dx <= 1; ++dx) {
            for (let dy = -1; dy <= 1; ++dy) {
                if (Math.abs(dx) + Math.abs(dy) !== 1) {
                    continue;
                }

                const entity = this.root.map.getLayerContentXY(tile.x + dx, tile.y + dy, "regular");
                if (entity) {
                    let ejectorSlots = [];
                    let acceptorSlots = [];

                    const staticComp = entity.components.StaticMapEntity;
                    const itemEjector = entity.components.ItemEjector;
                    const itemAcceptor = entity.components.ItemAcceptor;
                    const beltComp = entity.components.Belt;

                    if (itemEjector) {
                        ejectorSlots = itemEjector.slots.slice();
                    }

                    if (itemAcceptor) {
                        acceptorSlots = itemAcceptor.slots.slice();
                    }

                    if (beltComp) {
                        const fakeEjectorSlot = beltComp.getFakeEjectorSlot();
                        const fakeAcceptorSlot = beltComp.getFakeAcceptorSlot();
                        ejectorSlots.push(fakeEjectorSlot);
                        acceptorSlots.push(fakeAcceptorSlot);
                    }

                    for (let ejectorSlot = 0; ejectorSlot < ejectorSlots.length; ++ejectorSlot) {
                        const slot = ejectorSlots[ejectorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        const wsDirection = staticComp.localDirectionToWorld(slot.direction);
                        const targetTile = wsTile.add(enumDirectionToVector[wsDirection]);
                        if (targetTile.equals(tile)) {
                            ejectors.push({
                                entity,
                                slot,
                                fromTile: wsTile,
                                toDirection: wsDirection,
                            });
                        }
                    }

                    for (let acceptorSlot = 0; acceptorSlot < acceptorSlots.length; ++acceptorSlot) {
                        const slot = acceptorSlots[acceptorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        for (let k = 0; k < slot.directions.length; ++k) {
                            const direction = slot.directions[k];
                            const wsDirection = staticComp.localDirectionToWorld(direction);

                            const sourceTile = wsTile.add(enumDirectionToVector[wsDirection]);
                            if (sourceTile.equals(tile)) {
                                acceptors.push({
                                    entity,
                                    slot,
                                    toTile: wsTile,
                                    fromDirection: wsDirection,
                                });
                            }
                        }
                    }
                }
            }
        }
        return { ejectors, acceptors };
    }

    /**
     * Returns the acceptors and ejectors which affect the current tile
     * @param {Vector} tile
     * @param {string} variant
     * @returns {AcceptorsAndEjectorsAffectingTile}
     */
    getEjectorsAndAcceptorsAtTileForPipes(tile, variant) {
        /** @type {EjectorsAffectingTile} */
        let ejectors = [];
        /** @type {AcceptorsAffectingTile} */
        let acceptors = [];

        // Well .. please ignore this code! :D
        for (let dx = -1; dx <= 1; ++dx) {
            for (let dy = -1; dy <= 1; ++dy) {
                if (Math.abs(dx) + Math.abs(dy) !== 1) {
                    continue;
                }

                const entity = this.root.map.getLayerContentXY(tile.x + dx, tile.y + dy, "regular");
                if (entity) {
                    let ejectorSlots = [];
                    let acceptorSlots = [];

                    const staticComp = entity.components.StaticMapEntity;
                    const fluidEjector = entity.components.FluidEjector;
                    const fluidAcceptor = entity.components.FluidAcceptor;
                    const pipeComp = entity.components.Pipe;

                    if (fluidEjector) {
                        ejectorSlots = fluidEjector.slots.slice();
                    }

                    if (fluidAcceptor) {
                        acceptorSlots = fluidAcceptor.slots.slice();
                    }

                    if (pipeComp && pipeComp.variant === variant) {
                        const fakeEjectorSlot = pipeComp.getFakeEjectorSlot();
                        const fakeAcceptorSlot = pipeComp.getFakeAcceptorSlot();
                        ejectorSlots.push(fakeEjectorSlot);
                        acceptorSlots.push(fakeAcceptorSlot);
                    }

                    for (let ejectorSlot = 0; ejectorSlot < ejectorSlots.length; ++ejectorSlot) {
                        const slot = ejectorSlots[ejectorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        const wsDirection = staticComp.localDirectionToWorld(slot.direction);
                        const targetTile = wsTile.add(enumDirectionToVector[wsDirection]);
                        if (targetTile.equals(tile)) {
                            ejectors.push({
                                entity,
                                slot,
                                fromTile: wsTile,
                                toDirection: wsDirection,
                            });
                        }
                    }

                    for (let acceptorSlot = 0; acceptorSlot < acceptorSlots.length; ++acceptorSlot) {
                        const slot = acceptorSlots[acceptorSlot];
                        const wsTile = staticComp.localTileToWorld(slot.pos);
                        for (let k = 0; k < slot.directions.length; ++k) {
                            const direction = slot.directions[k];
                            const wsDirection = staticComp.localDirectionToWorld(direction);

                            const sourceTile = wsTile.add(enumDirectionToVector[wsDirection]);
                            if (sourceTile.equals(tile)) {
                                acceptors.push({
                                    entity,
                                    slot,
                                    toTile: wsTile,
                                    fromDirection: wsDirection,
                                });
                            }
                        }
                    }
                }
            }
        }
        return { ejectors, acceptors };
    }

    /**
     * Finds the follow up entity for a given pipe. Used for building the dependencies
     * @param {Entity} entity
     * @returns {Entity|null}
     */
    findFollowUpPipeEntity(entity) {
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
    findSupplyingPipeEntity(entity) {
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
     * Finds surrounding entities which are not yet assigned to a network
     * @param {Vector} initialTile
     * @param {Array<enumDirection>} directions
     * @param {WireNetwork} network
     * @param {enumWireVariant=} variantMask Only accept connections to this mask
     * @returns {Array<any>}
     */
    findSurroundingWireTargets(initialTile, directions, network, variantMask = null) {
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
                const wireComp = entity.components.Wire;

                // Check for wire
                if (
                    wireComp &&
                    !wireComp.linkedNetwork &&
                    (!variantMask || wireComp.variant === variantMask)
                ) {
                    // Wires accept connections from everywhere
                    result.push({
                        entity,
                    });
                }

                // Check for connected slots
                const pinComp = entity.components.WiredPins;
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
                const tunnelComp = entity.components.WireTunnel;
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
}
