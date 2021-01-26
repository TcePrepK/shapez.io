import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { createLogger } from "../core/logging";
import { Rectangle } from "../core/rectangle";
import { clamp, epsilonCompare, round4Digits } from "../core/utils";
import { enumDirection, enumDirectionToVector, enumInvertedDirections, Vector } from "../core/vector";
import { BasicSerializableObject, types } from "../savegame/serialization";
import { BaseItem } from "./base_item";
import { Entity } from "./entity";
import { typeItemSingleton } from "./item_resolver";
import { GameRoot } from "./root";

const logger = createLogger("pipe_path");

// Helpers for more semantic access into interleaved arrays
const _nextDistance = 0;
const _fluid = 1;

const DEBUG = G_IS_DEV && false;

/**
 * Stores a path of pipes, used for optimizing performance
 */
export class PipePath extends BasicSerializableObject {
    static getId() {
        return "PipePath";
    }

    static getSchema() {
        return {
            entityPath: types.array(types.entity),
            fluids: types.array(types.pair(types.ufloat, typeItemSingleton)),
            spacingToFirstFluid: types.ufloat,
        };
    }

    /**
     * Creates a path from a serialized object
     * @param {GameRoot} root
     * @param {Object} data
     * @returns {PipePath|string}
     */
    static fromSerialized(root, data) {
        // Create fake object which looks like a pipe path but skips the constructor
        const fakeObject = /** @type {PipePath} */ (Object.create(PipePath.prototype));
        fakeObject.root = root;

        // Deserialize the data
        const errorCodeDeserialize = fakeObject.deserialize(data);
        if (errorCodeDeserialize) {
            return errorCodeDeserialize;
        }

        // Compute other properties
        fakeObject.init(false);

        return fakeObject;
    }

    /**
     * @param {GameRoot} root
     * @param {Array<Entity>} entityPath
     */
    constructor(root, entityPath) {
        super();
        this.root = root;

        assert(entityPath.length > 0, "invalid entity path");
        this.entityPath = entityPath;

        /**
         * Stores the fluids sorted, and their distance to the previous fluid (or start)
         * Layout: [distanceToNext, fluid]
         * @type {Array<[number, BaseItem]>}
         */
        this.fluids = [];

        /**
         * Stores the spacing to the first fluid
         */

        this.init();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("constructor");
        }
    }
    /**
     * Initializes the path by computing the properties which are not saved
     * @param {boolean} computeSpacing Whether to also compute the spacing
     */
    init(computeSpacing = true) {
        this.onPathChanged();

        this.totalLength = this.computeTotalLength();

        if (computeSpacing) {
            this.spacingToFirstFluid = this.totalLength;
        }

        /**
         * Current bounds of this path
         * @type {Rectangle}
         */
        this.worldBounds = this.computeBounds();

        // Connect the pipes
        for (let i = 0; i < this.entityPath.length; ++i) {
            this.entityPath[i].components.Pipe.assignedPath = this;
        }
    }

    /**
     * Returns whether this path can accept a new fluid
     * @returns {boolean}
     */
    canAcceptFluid() {
        return this.spacingToFirstFluid >= globalConfig.fluidSpacingOnPipes;
    }

    /**
     * Tries to accept the fluid
     * @param {BaseItem} fluid
     */
    tryAcceptFluid(fluid) {
        if (this.spacingToFirstFluid >= globalConfig.fluidSpacingOnPipes) {
            // So, since we already need one tick to accept this fluid we will add this directly.
            const pipeProgressPerTick =
                this.root.hubGoals.getBeltBaseSpeed() *
                this.root.dynamicTickrate.deltaSeconds *
                globalConfig.fluidSpacingOnPipes;

            // First, compute how much progress we can make *at max*
            const maxProgress = Math.max(0, this.spacingToFirstFluid - globalConfig.fluidSpacingOnPipes);
            const initialProgress = Math.min(maxProgress, pipeProgressPerTick);

            this.fluids.unshift([this.spacingToFirstFluid - initialProgress, fluid]);
            this.spacingToFirstFluid = initialProgress;

            if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
                this.debug_checkIntegrity("accept-fluid");
            }

            return true;
        }
        return false;
    }

    /**
     * SLOW / Tries to find the fluid closest to the given tile
     * @param {Vector} tile
     * @returns {BaseItem|null}
     */
    findFluidAtTile(tile) {
        // @TODO: This breaks color blind mode otherwise
        return null;
    }

    /**
     * Computes the tile bounds of the path
     * @returns {Rectangle}
     */
    computeBounds() {
        let bounds = this.entityPath[0].components.StaticMapEntity.getTileSpaceBounds();
        for (let i = 1; i < this.entityPath.length; ++i) {
            const staticComp = this.entityPath[i].components.StaticMapEntity;
            const otherBounds = staticComp.getTileSpaceBounds();
            bounds = bounds.getUnion(otherBounds);
        }
        return bounds.allScaled(globalConfig.tileSize);
    }

    /**
     * Recomputes cache variables once the path was changed
     */
    onPathChanged() {
        this.acceptorTarget = this.computeAcceptingEntityAndSlot();

        /**
         * How many fluids past the first fluid are compressed
         */
        this.numCompressedFluidsAfterFirstFluid = 0;
    }

    /**
     * Called by the pipe system when the surroundings changed
     */
    onSurroundingsChanged() {
        this.onPathChanged();
    }

    /**
     * Finds the entity which accepts our fluids
     * @param {boolean=} debug_Silent Whether debug output should be silent
     * @return {{ entity: Entity, slot: number, direction?: enumDirection }}
     */
    computeAcceptingEntityAndSlot(debug_Silent = false) {
        DEBUG && !debug_Silent && logger.log("Recomputing acceptor target");

        const lastEntity = this.entityPath[this.entityPath.length - 1];
        const lastStatic = lastEntity.components.StaticMapEntity;
        const lastPipeComp = lastEntity.components.Pipe;

        // Figure out where and into which direction we eject fluids
        const ejectSlotWsTile = lastStatic.localTileToWorld(new Vector(0, 0));
        const ejectSlotWsDirection = lastStatic.localDirectionToWorld(lastPipeComp.direction);
        const ejectSlotWsDirectionVector = enumDirectionToVector[ejectSlotWsDirection];
        const ejectSlotTargetWsTile = ejectSlotWsTile.add(ejectSlotWsDirectionVector);

        // Try to find the given acceptor component to take the fluid
        const targetEntity = this.root.map.getLayerContentXY(
            ejectSlotTargetWsTile.x,
            ejectSlotTargetWsTile.y,
            "regular"
        );

        if (targetEntity) {
            DEBUG && !debug_Silent && logger.log("  Found target entity", targetEntity.uid);
            const targetStaticComp = targetEntity.components.StaticMapEntity;
            const targetPipeComp = targetEntity.components.Pipe;

            // Check for pipes (special case)
            if (targetPipeComp) {
                const pipeAcceptingDirection = targetStaticComp.localDirectionToWorld(enumDirection.top);
                DEBUG &&
                    !debug_Silent &&
                    logger.log(
                        "  Entity is accepting fluids from",
                        ejectSlotWsDirection,
                        "vs",
                        pipeAcceptingDirection,
                        "Rotation:",
                        targetStaticComp.rotation
                    );
                if (ejectSlotWsDirection === pipeAcceptingDirection) {
                    return {
                        entity: targetEntity,
                        direction: null,
                        slot: 0,
                    };
                }
            }

            // Check for fluid acceptors
            const targetAcceptorComp = targetEntity.components.FluidAcceptor;
            if (!targetAcceptorComp) {
                // Entity doesn't accept fluids
                return;
            }

            const ejectingDirection = targetStaticComp.worldDirectionToLocal(ejectSlotWsDirection);
            const matchingSlot = targetAcceptorComp.findMatchingSlot(
                targetStaticComp.worldToLocalTile(ejectSlotTargetWsTile),
                ejectingDirection
            );

            if (!matchingSlot) {
                // No matching slot found
                return;
            }

            return {
                entity: targetEntity,
                slot: matchingSlot.index,
                direction: enumInvertedDirections[ejectingDirection],
            };
        }
    }

    // Following code will be compiled out outside of dev versions
    /* dev:start */

    /**
     * Helper to throw an error on mismatch
     * @param {string} change
     * @param {Array<any>} reason
     */
    debug_failIntegrity(change, ...reason) {
        throw new Error("pipe path invalid (" + change + "): " + reason.map(i => "" + i).join(" "));
    }

    /**
     * Checks if this path is valid
     */
    debug_checkIntegrity(currentChange = "change") {
        const fail = (...args) => this.debug_failIntegrity(currentChange, ...args);

        // Check for empty path
        if (this.entityPath.length === 0) {
            return fail("Pipe path is empty");
        }

        // Check for mismatching length
        const totalLength = this.computeTotalLength();
        if (!epsilonCompare(this.totalLength, totalLength, 0.01)) {
            return this.debug_failIntegrity(
                currentChange,
                "Total length mismatch, stored =",
                this.totalLength,
                "but correct is",
                totalLength
            );
        }

        // Check for misconnected entities
        for (let i = 0; i < this.entityPath.length - 1; ++i) {
            const entity = this.entityPath[i];
            if (entity.destroyed) {
                return fail("Reference to destroyed entity " + entity.uid);
            }

            const followUp = this.root.systemMgr.systems.pipe.findFollowUpEntity(entity);
            if (!followUp) {
                return fail(
                    "Follow up entity for the",
                    i,
                    "-th entity (total length",
                    this.entityPath.length,
                    ") was null!"
                );
            }
            if (followUp !== this.entityPath[i + 1]) {
                return fail(
                    "Follow up entity mismatch, stored is",
                    this.entityPath[i + 1].uid,
                    "but real one is",
                    followUp.uid
                );
            }
            if (entity.components.Pipe.assignedPath !== this) {
                return fail(
                    "Entity with uid",
                    entity.uid,
                    "doesn't have this path assigned, but this path contains the entity."
                );
            }
        }

        // Check spacing
        if (this.spacingToFirstFluid > this.totalLength + 0.005) {
            return fail(
                currentChange,
                "spacing to first fluid (",
                this.spacingToFirstFluid,
                ") is greater than total length (",
                this.totalLength,
                ")"
            );
        }

        // Check distance if empty
        if (this.fluids.length === 0 && !epsilonCompare(this.spacingToFirstFluid, this.totalLength, 0.01)) {
            return fail(
                currentChange,
                "Path is empty but spacing to first fluid (",
                this.spacingToFirstFluid,
                ") does not equal total length (",
                this.totalLength,
                ")"
            );
        }

        // Check fluids etc
        let currentPos = this.spacingToFirstFluid;
        for (let i = 0; i < this.fluids.length; ++i) {
            const fluid = this.fluids[i];

            if (fluid[_nextDistance] < 0 || fluid[_nextDistance] > this.totalLength + 0.02) {
                return fail(
                    "Fluid has invalid offset to next fluid: ",
                    fluid[_nextDistance],
                    "(total length:",
                    this.totalLength,
                    ")"
                );
            }

            currentPos += fluid[_nextDistance];
        }

        // Check the total sum matches
        if (!epsilonCompare(currentPos, this.totalLength, 0.01)) {
            return fail(
                "total sum (",
                currentPos,
                ") of first fluid spacing (",
                this.spacingToFirstFluid,
                ") and fluids does not match total length (",
                this.totalLength,
                ") -> fluids: " + this.fluids.map(i => i[_nextDistance]).join("|")
            );
        }

        // Check bounds
        const actualBounds = this.computeBounds();
        if (!actualBounds.equalsEpsilon(this.worldBounds, 0.01)) {
            return fail("Bounds are stale");
        }

        // Check acceptor
        const acceptor = this.computeAcceptingEntityAndSlot(true);
        if (!!acceptor !== !!this.acceptorTarget) {
            return fail("Acceptor target mismatch, acceptor", !!acceptor, "vs stored", !!this.acceptorTarget);
        }

        if (acceptor) {
            if (this.acceptorTarget.entity !== acceptor.entity) {
                return fail(
                    "Mismatching entity on acceptor target:",
                    acceptor.entity.uid,
                    "vs",
                    this.acceptorTarget.entity.uid
                );
            }

            if (this.acceptorTarget.slot !== acceptor.slot) {
                return fail(
                    "Mismatching entity on acceptor target:",
                    acceptor.slot,
                    "vs stored",
                    this.acceptorTarget.slot
                );
            }

            if (this.acceptorTarget.direction !== acceptor.direction) {
                return fail(
                    "Mismatching direction on acceptor target:",
                    acceptor.direction,
                    "vs stored",
                    this.acceptorTarget.direction
                );
            }
        }

        // Check first nonzero offset
        let firstNonzero = 0;
        for (let i = this.fluids.length - 2; i >= 0; --i) {
            if (this.fluids[i][_nextDistance] < globalConfig.fluidSpacingOnPipes + 1e-5) {
                ++firstNonzero;
            } else {
                break;
            }
        }

        // Should warn, but this check isn't actually accurate
        // if (firstNonzero !== this.numCompressedFluidsAfterFirstFluid) {
        //     console.warn(
        //         "First nonzero index is " +
        //             firstNonzero +
        //             " but stored is " +
        //             this.numCompressedFluidsAfterFirstFluid
        //     );
        // }
    }

    /* dev:end */

    /**
     * Extends the pipe path by the given pipe
     * @param {Entity} entity
     */
    extendOnEnd(entity) {
        DEBUG && logger.log("Extending pipe path by entity at", entity.components.StaticMapEntity.origin);

        const pipeComp = entity.components.Pipe;

        // Append the entity
        this.entityPath.push(entity);
        this.onPathChanged();

        // Extend the path length
        const additionalLength = pipeComp.getEffectiveLengthTiles();
        this.totalLength += additionalLength;
        DEBUG && logger.log("  Extended total length by", additionalLength, "to", this.totalLength);

        // If we have no fluid, just update the distance to the first fluid
        if (this.fluids.length === 0) {
            this.spacingToFirstFluid = this.totalLength;
            DEBUG && logger.log("  Extended spacing to first to", this.totalLength, "(= total length)");
        } else {
            // Otherwise, update the next-distance of the last fluid
            const lastFluid = this.fluids[this.fluids.length - 1];
            DEBUG &&
                logger.log(
                    "  Extended spacing of last fluid from",
                    lastFluid[_nextDistance],
                    "to",
                    lastFluid[_nextDistance] + additionalLength
                );
            lastFluid[_nextDistance] += additionalLength;
        }

        // Assign reference
        pipeComp.assignedPath = this;

        // Update bounds
        this.worldBounds = this.computeBounds();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("extend-on-end");
        }
    }

    /**
     * Extends the path with the given entity on the beginning
     * @param {Entity} entity
     */
    extendOnBeginning(entity) {
        const pipeComp = entity.components.Pipe;

        DEBUG && logger.log("Extending the path on the beginning");

        // All fluids on that pipe are simply lost (for now)

        const length = pipeComp.getEffectiveLengthTiles();

        // Extend the length of this path
        this.totalLength += length;

        // Simply adjust the first fluid spacing cuz we have no fluids contained
        this.spacingToFirstFluid += length;

        // Set handles and append entity
        pipeComp.assignedPath = this;
        this.entityPath.unshift(entity);
        this.onPathChanged();

        // Update bounds
        this.worldBounds = this.computeBounds();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("extend-on-begin");
        }
    }

    /**
     * Returns if the given entity is the end entity of the path
     * @param {Entity} entity
     * @returns {boolean}
     */
    isEndEntity(entity) {
        return this.entityPath[this.entityPath.length - 1] === entity;
    }

    /**
     * Returns if the given entity is the start entity of the path
     * @param {Entity} entity
     * @returns {boolean}
     */
    isStartEntity(entity) {
        return this.entityPath[0] === entity;
    }

    /**
     * Splits this path at the given entity by removing it, and
     * returning the new secondary paht
     * @param {Entity} entity
     * @returns {PipePath}
     */
    deleteEntityOnPathSplitIntoTwo(entity) {
        DEBUG && logger.log("Splitting path at entity", entity.components.StaticMapEntity.origin);

        // First, find where the current path ends
        const pipeComp = entity.components.Pipe;
        pipeComp.assignedPath = null;

        const entityLength = pipeComp.getEffectiveLengthTiles();
        assert(this.entityPath.indexOf(entity) >= 0, "Entity not contained for split");
        assert(this.entityPath.indexOf(entity) !== 0, "Entity is first");
        assert(this.entityPath.indexOf(entity) !== this.entityPath.length - 1, "Entity is last");

        let firstPathEntityCount = 0;
        let firstPathLength = 0;
        let firstPathEndEntity = null;

        for (let i = 0; i < this.entityPath.length; ++i) {
            const otherEntity = this.entityPath[i];
            if (otherEntity === entity) {
                DEBUG && logger.log("Found entity at", i, "of length", firstPathLength);
                break;
            }

            ++firstPathEntityCount;
            firstPathEndEntity = otherEntity;
            firstPathLength += otherEntity.components.Pipe.getEffectiveLengthTiles();
        }

        DEBUG &&
            logger.log(
                "First path ends at",
                firstPathLength,
                "and entity",
                firstPathEndEntity.components.StaticMapEntity.origin,
                "and has",
                firstPathEntityCount,
                "entities"
            );

        // Compute length of second path
        const secondPathLength = this.totalLength - firstPathLength - entityLength;
        const secondPathStart = firstPathLength + entityLength;
        const secondEntities = this.entityPath.splice(firstPathEntityCount + 1);
        DEBUG &&
            logger.log(
                "Second path starts at",
                secondPathStart,
                "and has a length of ",
                secondPathLength,
                "with",
                secondEntities.length,
                "entities"
            );

        // Remove the last fluid
        this.entityPath.pop();

        DEBUG && logger.log("Splitting", this.fluids.length, "fluids");
        DEBUG &&
            logger.log(
                "Old fluids are",
                this.fluids.map(i => i[_nextDistance])
            );

        // Create second path
        const secondPath = new PipePath(this.root, secondEntities);

        // Remove all fluids which are no longer relevant and transfer them to the second path
        let fluidPos = this.spacingToFirstFluid;
        for (let i = 0; i < this.fluids.length; ++i) {
            const fluid = this.fluids[i];
            const distanceToNext = fluid[_nextDistance];

            DEBUG &&
                logger.log("  Checking fluid at", fluidPos, "with distance of", distanceToNext, "to next");

            // Check if this fluid is past the first path
            if (fluidPos >= firstPathLength) {
                // Remove it from the first path
                this.fluids.splice(i, 1);
                i -= 1;
                DEBUG &&
                    logger.log(
                        "     Removed fluid from first path since its no longer contained @",
                        fluidPos
                    );

                // Check if its on the second path (otherwise its on the removed pipe and simply lost)
                if (fluidPos >= secondPathStart) {
                    // Put fluid on second path
                    secondPath.fluids.push([distanceToNext, fluid[_fluid]]);
                    DEBUG &&
                        logger.log(
                            "     Put fluid to second path @",
                            fluidPos,
                            "with distance to next =",
                            distanceToNext
                        );

                    // If it was the first fluid, adjust the distance to the first fluid
                    if (secondPath.fluids.length === 1) {
                        DEBUG &&
                            logger.log("       Sinc it was the first, set sapcing of first to", fluidPos);
                        secondPath.spacingToFirstFluid = fluidPos - secondPathStart;
                    }
                } else {
                    DEBUG && logger.log("    Fluid was on the removed pipe, so its gone - forever!");
                }
            } else {
                // Seems this fluid is on the first path (so all good), so just make sure it doesn't
                // have a nextDistance which is bigger than the total path length
                const clampedDistanceToNext = Math.min(fluidPos + distanceToNext, firstPathLength) - fluidPos;
                if (clampedDistanceToNext < distanceToNext) {
                    DEBUG &&
                        logger.log(
                            "Correcting next distance (first path) from",
                            distanceToNext,
                            "to",
                            clampedDistanceToNext
                        );
                    fluid[_nextDistance] = clampedDistanceToNext;
                }
            }

            // Advance fluids
            fluidPos += distanceToNext;
        }

        DEBUG &&
            logger.log(
                "New fluids are",
                this.fluids.map(i => i[_nextDistance])
            );

        DEBUG &&
            logger.log(
                "And second path fluids are",
                secondPath.fluids.map(i => i[_nextDistance])
            );

        // Adjust our total length
        this.totalLength = firstPathLength;

        // Make sure that if we are empty, we set our first distance properly
        if (this.fluids.length === 0) {
            this.spacingToFirstFluid = this.totalLength;
        }

        this.onPathChanged();
        secondPath.onPathChanged();

        // Update bounds
        this.worldBounds = this.computeBounds();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("split-two-first");
            secondPath.debug_checkIntegrity("split-two-second");
        }

        return secondPath;
    }

    /**
     * Deletes the last entity
     * @param {Entity} entity
     */
    deleteEntityOnEnd(entity) {
        assert(
            this.entityPath[this.entityPath.length - 1] === entity,
            "Not actually the last entity (instead " + this.entityPath.indexOf(entity) + ")"
        );

        // Ok, first remove the entity
        const pipeComp = entity.components.Pipe;
        const pipeLength = pipeComp.getEffectiveLengthTiles();

        DEBUG &&
            logger.log(
                "Deleting last entity on path with length",
                this.entityPath.length,
                "(reducing",
                this.totalLength,
                " by",
                pipeLength,
                ")"
            );
        this.totalLength -= pipeLength;
        this.entityPath.pop();
        this.onPathChanged();

        DEBUG &&
            logger.log(
                "  New path has length of",
                this.totalLength,
                "with",
                this.entityPath.length,
                "entities"
            );

        // This is just for sanity
        pipeComp.assignedPath = null;

        // Clean up fluids
        if (this.fluids.length === 0) {
            // Simple case with no fluids, just update the first fluid spacing
            this.spacingToFirstFluid = this.totalLength;
        } else {
            // Ok, make sure we simply drop all fluids which are no longer contained
            let fluidOffset = this.spacingToFirstFluid;
            let lastFluidOffset = fluidOffset;

            DEBUG && logger.log("  Adjusting", this.fluids.length, "fluids");

            for (let i = 0; i < this.fluids.length; ++i) {
                const fluid = this.fluids[i];

                // Get rid of fluids past this path
                if (fluidOffset >= this.totalLength) {
                    DEBUG && logger.log("Dropping fluid (current index=", i, ")");
                    this.fluids.splice(i, 1);
                    i -= 1;
                    continue;
                }

                DEBUG &&
                    logger.log("Fluid", i, "is at", fluidOffset, "with next offset", fluid[_nextDistance]);
                lastFluidOffset = fluidOffset;
                fluidOffset += fluid[_nextDistance];
            }

            // If we still have an fluid, make sure the last fluid matches
            if (this.fluids.length > 0) {
                // We can easily compute the next distance since we know where the last fluid is now
                const lastDistance = this.totalLength - lastFluidOffset;
                assert(
                    lastDistance >= 0.0,
                    "Last fluid distance mismatch: " +
                        lastDistance +
                        " -> Total length was " +
                        this.totalLength +
                        " and lastFluidOffset was " +
                        lastFluidOffset
                );

                DEBUG &&
                    logger.log(
                        "Adjusted distance of last fluid: it is at",
                        lastFluidOffset,
                        "so it has a distance of",
                        lastDistance,
                        "to the end (",
                        this.totalLength,
                        ")"
                    );
                this.fluids[this.fluids.length - 1][_nextDistance] = lastDistance;
            } else {
                DEBUG && logger.log("  Removed all fluids so we'll update spacing to total length");

                // We removed all fluids so update our spacing
                this.spacingToFirstFluid = this.totalLength;
            }
        }

        // Update bounds
        this.worldBounds = this.computeBounds();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("delete-on-end");
        }
    }

    /**
     * Deletes the entity of the start of the path
     * @see deleteEntityOnEnd
     * @param {Entity} entity
     */
    deleteEntityOnStart(entity) {
        assert(
            entity === this.entityPath[0],
            "Not actually the start entity (instead " + this.entityPath.indexOf(entity) + ")"
        );

        // Ok, first remove the entity
        const pipeComp = entity.components.Pipe;
        const pipeLength = pipeComp.getEffectiveLengthTiles();

        DEBUG &&
            logger.log(
                "Deleting first entity on path with length",
                this.entityPath.length,
                "(reducing",
                this.totalLength,
                " by",
                pipeLength,
                ")"
            );
        this.totalLength -= pipeLength;
        this.entityPath.shift();
        this.onPathChanged();

        DEBUG &&
            logger.log(
                "  New path has length of",
                this.totalLength,
                "with",
                this.entityPath.length,
                "entities"
            );

        // This is just for sanity
        pipeComp.assignedPath = null;

        // Clean up fluids
        if (this.fluids.length === 0) {
            // Simple case with no fluids, just update the first fluid spacing
            this.spacingToFirstFluid = this.totalLength;
        } else {
            // Simple case, we had no fluid on the beginning -> all good
            if (this.spacingToFirstFluid >= pipeLength) {
                DEBUG &&
                    logger.log(
                        "  No fluid on the first place, so we can just adjust the spacing (spacing=",
                        this.spacingToFirstFluid,
                        ") removed =",
                        pipeLength
                    );
                this.spacingToFirstFluid -= pipeLength;
            } else {
                // Welp, okay we need to drop all fluids which are < pipeLength and adjust
                // the other fluid offsets as well

                DEBUG &&
                    logger.log(
                        "  We have at least one fluid in the beginning, drop those and adjust spacing (first fluid @",
                        this.spacingToFirstFluid,
                        ") since we removed",
                        pipeLength,
                        "length from path"
                    );
                DEBUG &&
                    logger.log(
                        "    Fluids:",
                        this.fluids.map(i => i[_nextDistance])
                    );

                // Find offset to first fluid
                let fluidOffset = this.spacingToFirstFluid;
                for (let i = 0; i < this.fluids.length; ++i) {
                    const fluid = this.fluids[i];
                    if (fluidOffset <= pipeLength) {
                        DEBUG &&
                            logger.log(
                                "  -> Dropping fluid with index",
                                i,
                                "at",
                                fluidOffset,
                                "since it was on the removed pipe"
                            );
                        // This fluid must be dropped
                        this.fluids.splice(i, 1);
                        i -= 1;
                        fluidOffset += fluid[_nextDistance];
                        continue;
                    } else {
                        // This fluid can be kept, thus its the first we know
                        break;
                    }
                }

                if (this.fluids.length > 0) {
                    DEBUG &&
                        logger.log(
                            "  Offset of first non-dropped fluid was at:",
                            fluidOffset,
                            "-> setting spacing to it (total length=",
                            this.totalLength,
                            ")"
                        );

                    this.spacingToFirstFluid = fluidOffset - pipeLength;
                    assert(
                        this.spacingToFirstFluid >= 0.0,
                        "Invalid spacing after delete on start: " + this.spacingToFirstFluid
                    );
                } else {
                    DEBUG && logger.log("  We dropped all fluids, simply set spacing to total length");
                    // We dropped all fluids, simple one
                    this.spacingToFirstFluid = this.totalLength;
                }
            }
        }

        // Update bounds
        this.worldBounds = this.computeBounds();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("delete-on-start");
        }
    }

    /**
     * Extends the path by the given other path
     * @param {PipePath} otherPath
     */
    extendByPath(otherPath) {
        assert(otherPath !== this, "Circular path dependency");

        const entities = otherPath.entityPath;
        DEBUG && logger.log("Extending path by other path, starting to add entities");

        const oldLength = this.totalLength;

        DEBUG && logger.log("  Adding", entities.length, "new entities, current length =", this.totalLength);

        // First, append entities
        for (let i = 0; i < entities.length; ++i) {
            const entity = entities[i];
            const pipeComp = entity.components.Pipe;

            // Add to path and update references
            this.entityPath.push(entity);
            pipeComp.assignedPath = this;

            // Update our length
            const additionalLength = pipeComp.getEffectiveLengthTiles();
            this.totalLength += additionalLength;
        }

        DEBUG &&
            logger.log(
                "  Path is now",
                this.entityPath.length,
                "entities and has a length of",
                this.totalLength
            );

        // Now, update the distance of our last fluid
        if (this.fluids.length !== 0) {
            const lastFluid = this.fluids[this.fluids.length - 1];
            lastFluid[_nextDistance] += otherPath.spacingToFirstFluid;
            DEBUG &&
                logger.log(
                    "  Add distance to last fluid, effectively being",
                    lastFluid[_nextDistance],
                    "now"
                );
        } else {
            // Seems we have no fluids, update our first fluid distance
            this.spacingToFirstFluid = oldLength + otherPath.spacingToFirstFluid;
            DEBUG &&
                logger.log(
                    "  We had no fluids, so our new spacing to first is old length (",
                    oldLength,
                    ") plus others spacing to first (",
                    otherPath.spacingToFirstFluid,
                    ") =",
                    this.spacingToFirstFluid
                );
        }

        DEBUG && logger.log("  Pushing", otherPath.fluids.length, "fluids from other path");

        // Aaand push the other paths fluids
        for (let i = 0; i < otherPath.fluids.length; ++i) {
            const fluid = otherPath.fluids[i];
            this.fluids.push([fluid[_nextDistance], fluid[_fluid]]);
        }

        // Update bounds
        this.worldBounds = this.computeBounds();

        this.onPathChanged();

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("extend-by-path");
        }
    }

    /**
     * Computes the total length of the path
     * @returns {number}
     */
    computeTotalLength() {
        let length = 0;
        for (let i = 0; i < this.entityPath.length; ++i) {
            const entity = this.entityPath[i];
            length += entity.components.Pipe.getEffectiveLengthTiles();
        }
        return length;
    }

    /**
     * Performs one tick
     */
    update() {
        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("pre-update");
        }

        // Divide by fluid spacing on pipes since we use throughput and not speed
        let pipeSpeed =
            this.root.hubGoals.getBeltBaseSpeed() *
            this.root.dynamicTickrate.deltaSeconds *
            globalConfig.fluidSpacingOnPipes;

        if (G_IS_DEV && globalConfig.debug.instantPipes) {
            pipeSpeed *= 100;
        }

        // Store whether this is the first fluid we processed, so premature
        // fluid ejection is available
        let isFirstFluidProcessed = true;

        // Store how much velocity (strictly its distance, not velocity) we have to distribute over all fluids
        let remainingVelocity = pipeSpeed;

        // Store the last fluid we processed, so we can skip clashed ones
        let lastFluidProcessed;

        for (lastFluidProcessed = this.fluids.length - 1; lastFluidProcessed >= 0; --lastFluidProcessed) {
            const nextDistanceAndFluid = this.fluids[lastFluidProcessed];

            // Compute how much spacing we need at least
            const minimumSpacing =
                lastFluidProcessed === this.fluids.length - 1 ? 0 : globalConfig.fluidSpacingOnPipes;

            // Compute how much we can advance
            const clampedProgress = Math.max(
                0,
                Math.min(remainingVelocity, nextDistanceAndFluid[_nextDistance] - minimumSpacing)
            );

            // Reduce our velocity by the amount we consumed
            remainingVelocity -= clampedProgress;

            // Reduce the spacing
            nextDistanceAndFluid[_nextDistance] -= clampedProgress;

            // Advance all fluids behind by the progress we made
            this.spacingToFirstFluid += clampedProgress;

            // If the last fluid can be ejected, eject it and reduce the spacing, because otherwise
            // we lose velocity
            if (isFirstFluidProcessed && nextDistanceAndFluid[_nextDistance] < 1e-7) {
                // Store how much velocity we "lost" because we bumped the fluid to the end of the
                // pipe but couldn't move it any farther. We need this to tell the fluid acceptor
                // animation to start a tad later, so everything matches up. Yes I'm a perfectionist.
                const excessVelocity = pipeSpeed - clampedProgress;

                // Try to directly get rid of the fluid
                if (this.tryHandOverFluid(nextDistanceAndFluid[_fluid], excessVelocity)) {
                    this.fluids.pop();

                    const fluidBehind = this.fluids[lastFluidProcessed - 1];
                    if (fluidBehind && this.numCompressedFluidsAfterFirstFluid > 0) {
                        // So, with the next tick we will skip this fluid, but it actually has the potential
                        // to process farther -> If we don't advance here, we loose a tiny bit of progress
                        // every tick which causes the pipe to be slower than it actually is.
                        // Also see #999
                        const fixupProgress = Math.max(
                            0,
                            Math.min(remainingVelocity, fluidBehind[_nextDistance])
                        );

                        // See above
                        fluidBehind[_nextDistance] -= fixupProgress;
                        remainingVelocity -= fixupProgress;
                        this.spacingToFirstFluid += fixupProgress;
                    }

                    // Reduce the number of compressed fluids since the first fluid no longer exists
                    this.numCompressedFluidsAfterFirstFluid = Math.max(
                        0,
                        this.numCompressedFluidsAfterFirstFluid - 1
                    );
                }
            }

            if (isFirstFluidProcessed) {
                // Skip N null fluids after first fluids
                lastFluidProcessed -= this.numCompressedFluidsAfterFirstFluid;
            }

            isFirstFluidProcessed = false;
            if (remainingVelocity < 1e-7) {
                break;
            }
        }

        // Compute compressed fluid count
        this.numCompressedFluidsAfterFirstFluid = Math.max(
            0,
            this.numCompressedFluidsAfterFirstFluid,
            this.fluids.length - 2 - lastFluidProcessed
        );

        // Check if we have an fluid which is ready to be emitted
        const lastFluid = this.fluids[this.fluids.length - 1];
        if (lastFluid && lastFluid[_nextDistance] === 0 && this.acceptorTarget) {
            if (this.tryHandOverFluid(lastFluid[_fluid])) {
                this.fluids.pop();
                this.numCompressedFluidsAfterFirstFluid = Math.max(
                    0,
                    this.numCompressedFluidsAfterFirstFluid - 1
                );
            }
        }

        if (G_IS_DEV && globalConfig.debug.checkPipePaths) {
            this.debug_checkIntegrity("post-update");
        }
    }

    /**
     * Tries to hand over the fluid to the end entity
     * @param {BaseItem} fluid
     */
    tryHandOverFluid(fluid, remainingProgress = 0.0) {
        if (!this.acceptorTarget) {
            return;
        }

        const targetAcceptorComp = this.acceptorTarget.entity.components.FluidAcceptor;

        // Check if the acceptor has a filter for example
        if (targetAcceptorComp && !targetAcceptorComp.canAcceptFluid(this.acceptorTarget.slot, fluid)) {
            // Well, this fluid is not accepted
            return false;
        }

        // Try to pass over
        if (
            this.root.systemMgr.systems.fluidEjector.tryPassOverFluid(
                fluid,
                this.acceptorTarget.entity,
                this.acceptorTarget.slot
            )
        ) {
            // Trigger animation on the acceptor comp
            const targetAcceptorComp = this.acceptorTarget.entity.components.FluidAcceptor;
            if (targetAcceptorComp) {
                if (!this.root.app.settings.getAllSettings().simplifiedBelts) {
                    targetAcceptorComp.onFluidAccepted(
                        this.acceptorTarget.slot,
                        this.acceptorTarget.direction,
                        fluid,
                        remainingProgress
                    );
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Computes a world space position from the given progress
     * @param {number} progress
     * @returns {Vector}
     */
    computePositionFromProgress(progress) {
        let currentLength = 0;

        // floating point issues ..
        assert(progress <= this.totalLength + 0.02, "Progress too big: " + progress);

        for (let i = 0; i < this.entityPath.length; ++i) {
            const pipeComp = this.entityPath[i].components.Pipe;
            const localLength = pipeComp.getEffectiveLengthTiles();

            if (currentLength + localLength >= progress || i === this.entityPath.length - 1) {
                // Min required here due to floating point issues
                const localProgress = Math.min(1.0, progress - currentLength);

                assert(localProgress >= 0.0, "Invalid local progress: " + localProgress);
                const localSpace = pipeComp.transformPipeToLocalSpace(localProgress);
                return this.entityPath[i].components.StaticMapEntity.localTileToWorld(localSpace);
            }
            currentLength += localLength;
        }

        assert(false, "invalid progress: " + progress + " (max: " + this.totalLength + ")");
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    drawDebug(parameters) {
        if (!parameters.visibleRect.containsRect(this.worldBounds)) {
            return;
        }

        parameters.context.fillStyle = "#d79a25";
        parameters.context.strokeStyle = "#d79a25";
        parameters.context.beginPath();

        for (let i = 0; i < this.entityPath.length; ++i) {
            const entity = this.entityPath[i];
            const pos = entity.components.StaticMapEntity;
            const worldPos = pos.origin.toWorldSpaceCenterOfTile();

            if (i === 0) {
                parameters.context.moveTo(worldPos.x, worldPos.y);
            } else {
                parameters.context.lineTo(worldPos.x, worldPos.y);
            }
        }
        parameters.context.stroke();

        // Fluids
        let progress = this.spacingToFirstFluid;
        for (let i = 0; i < this.fluids.length; ++i) {
            const nextDistanceAndFluid = this.fluids[i];
            const worldPos = this.computePositionFromProgress(progress).toWorldSpaceCenterOfTile();
            parameters.context.fillStyle = "#268e4d";
            parameters.context.beginRoundedRect(worldPos.x - 5, worldPos.y - 5, 10, 10, 3);
            parameters.context.fill();
            parameters.context.font = "6px GameFont";
            parameters.context.fillStyle = "#111";
            parameters.context.fillText(
                "" + round4Digits(nextDistanceAndFluid[_nextDistance]),
                worldPos.x + 5,
                worldPos.y + 2
            );
            progress += nextDistanceAndFluid[_nextDistance];

            if (this.fluids.length - 1 - this.numCompressedFluidsAfterFirstFluid === i) {
                parameters.context.fillStyle = "red";
                parameters.context.fillRect(worldPos.x + 5, worldPos.y, 20, 3);
            }
        }

        for (let i = 0; i < this.entityPath.length; ++i) {
            const entity = this.entityPath[i];
            parameters.context.fillStyle = "#d79a25";
            const pos = entity.components.StaticMapEntity;
            const worldPos = pos.origin.toWorldSpaceCenterOfTile();
            parameters.context.beginCircle(worldPos.x, worldPos.y, i === 0 ? 5 : 3);
            parameters.context.fill();
        }

        for (let progress = 0; progress <= this.totalLength + 0.01; progress += 0.2) {
            const worldPos = this.computePositionFromProgress(progress).toWorldSpaceCenterOfTile();
            parameters.context.fillStyle = "red";
            parameters.context.beginCircle(worldPos.x, worldPos.y, 1);
            parameters.context.fill();
        }

        const firstFluidIndicator = this.computePositionFromProgress(
            this.spacingToFirstFluid
        ).toWorldSpaceCenterOfTile();
        parameters.context.fillStyle = "purple";
        parameters.context.fillRect(firstFluidIndicator.x - 3, firstFluidIndicator.y - 1, 6, 2);
    }

    /**
     * Checks if this pipe path should render simplified
     */
    checkIsPotatoMode() {
        // POTATO Mode: Only show fluids when pipe is hovered
        if (!this.root.app.settings.getAllSettings().simplifiedBelts) {
            return false;
        }

        if (this.root.currentLayer !== "regular") {
            // Not in regular layer
            return true;
        }

        const mousePos = this.root.app.mousePosition;
        if (!mousePos) {
            // Mouse not registered
            return true;
        }

        const tile = this.root.camera.screenToWorld(mousePos).toTileSpace();
        const contents = this.root.map.getLayerContentXY(tile.x, tile.y, "regular");
        if (!contents || !contents.components.Pipe) {
            // Nothing below
            return true;
        }

        if (contents.components.Pipe.assignedPath !== this) {
            // Not this path
            return true;
        }
        return false;
    }

    /**
     * Draws the path
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        if (!parameters.visibleRect.containsRect(this.worldBounds)) {
            return;
        }

        if (this.fluids.length === 0) {
            // Early out
            return;
        }

        if (this.checkIsPotatoMode()) {
            const firstFluid = this.fluids[0];
            if (this.entityPath.length > 1 && firstFluid) {
                const medianPipeIndex = clamp(
                    Math.round(this.entityPath.length / 2 - 1),
                    0,
                    this.entityPath.length - 1
                );
                const medianPipe = this.entityPath[medianPipeIndex];
                const pipeComp = medianPipe.components.Pipe;
                const staticComp = medianPipe.components.StaticMapEntity;
                const centerPosLocal = pipeComp.transformPipeToLocalSpace(
                    this.entityPath.length % 2 === 0 ? pipeComp.getEffectiveLengthTiles() : 0.5
                );
                const centerPos = staticComp.localTileToWorld(centerPosLocal).toWorldSpaceCenterOfTile();

                parameters.context.globalAlpha = 0.5;
                firstFluid[_fluid].drawItemCenteredClipped(centerPos.x, centerPos.y, parameters);
                parameters.context.globalAlpha = 1;
            }

            return;
        }

        let currentFluidPos = this.spacingToFirstFluid;
        let currentFluidIndex = 0;

        let trackPos = 0.0;

        // Iterate whole track and check fluids
        for (let i = 0; i < this.entityPath.length; ++i) {
            const entity = this.entityPath[i];
            const pipeComp = entity.components.Pipe;
            const pipeLength = pipeComp.getEffectiveLengthTiles();

            // Check if the current fluids are on the pipe
            while (trackPos + pipeLength >= currentFluidPos - 1e-5) {
                // It's on the pipe, render it now
                const staticComp = entity.components.StaticMapEntity;
                assert(
                    currentFluidPos - trackPos >= 0,
                    "invalid track pos: " + currentFluidPos + " vs " + trackPos + " (l  =" + pipeLength + ")"
                );

                const localPos = pipeComp.transformPipeToLocalSpace(currentFluidPos - trackPos);
                const worldPos = staticComp.localTileToWorld(localPos).toWorldSpaceCenterOfTile();

                const distanceAndFluid = this.fluids[currentFluidIndex];

                distanceAndFluid[_fluid].drawItemCenteredClipped(
                    worldPos.x,
                    worldPos.y,
                    parameters,
                    globalConfig.defaultFluidDiameter
                );

                // Check for the next fluid
                currentFluidPos += distanceAndFluid[_nextDistance];
                ++currentFluidIndex;

                if (currentFluidIndex >= this.fluids.length) {
                    // We rendered all fluids
                    return;
                }
            }

            trackPos += pipeLength;
        }
    }
}
