import { globalConfig } from "../core/config";
import { DrawParameters } from "../core/draw_parameters";
import { findNiceIntegerValue } from "../core/utils";
import { Vector } from "../core/vector";
import { Entity } from "./entity";
import { ACHIEVEMENTS } from "../platform/achievement_provider";
import { GameRoot } from "./root";
import { SerializerInternal } from "../savegame/serializer_internal";
import { createLogger } from "../core/logging";
import { compressU8WHeader, decompressU8WHeader } from "../core/lzstring";
import { StaticMapEntityComponent } from "./components/static_map_entity";
import { gComponentRegistry } from "../core/global_registries";
import { Component } from "./component";

const logger = createLogger("blueprint");

export class Blueprint {
    /**
     * @param {Array<Entity>} entities
     */
    constructor(entities) {
        this.entities = entities;
    }

    /**
     * Returns the layer of this blueprint
     * @returns {Layer}
     */
    get layer() {
        if (this.entities.length === 0) {
            return "regular";
        }
        return this.entities[0].layer;
    }

    /**
     * Serialize
     */
    serialize() {
        const data = new SerializerInternal().serializeEntityArray(this.entities);
        // Compress data
        const compressedData = Blueprint.compressSerializedData(data);
        // Stringfy
        const json = JSON.stringify(compressedData);
        // Return compressed json
        return compressU8WHeader(json, 0);
    }

    /**
     * Deserialize
     * @param {GameRoot} root
     * @param {Object} json
     * @retruns {Blueprint|void}
     */
    static deserialize(root, json) {
        try {
            if (typeof json != "object") {
                return;
            }
            if (!Array.isArray(json)) {
                return;
            }

            const serializer = new SerializerInternal();
            /** @type {Array<Entity>} */
            const entityArray = [];
            for (const /** @type {Entity?} */ value of json) {
                if (value.components == undefined || value.components.StaticMapEntity == undefined) {
                    return;
                }
                const staticData = value.components.StaticMapEntity;
                if (staticData.code == undefined || staticData.origin == undefined) {
                    return;
                }
                const result = serializer.deserializeEntity(root, value);
                if (typeof result === "string") {
                    throw new Error(result);
                }
                entityArray.push(result);
            }
            return new Blueprint(entityArray);
        } catch (e) {
            logger.error("Invalid blueprint data:", e.message);
        }
    }

    /**
     * Compresses serialized blueprint
     * @param {Array<Object>} data
     */
    static compressSerializedData(data) {
        for (const entry of data) {
            // Remove useless data
            delete entry.uid;

            // Move code to components
            entry.c = entry.components.StaticMapEntity.code;

            // Move origin to components
            entry.x = entry.components.StaticMapEntity.origin.x;
            entry.y = entry.components.StaticMapEntity.origin.y;

            // Move rotations to components with mixing them
            const r = entry.components.StaticMapEntity.rotation / 90;
            const ro = entry.components.StaticMapEntity.originalRotation / 90;
            entry.r = r + (ro << 2);
            delete entry.components.StaticMapEntity;

            // // Remove useless data within constant signal
            // if (entry.components.ConstantSignal) {
            //     const data = entry.components.ConstantSignal.signal.data;
            //     entry.s = data.replace(/:/g, "");
            // }

            for (const id in entry.components) {
                const comp = gComponentRegistry.findById(id);
                // @ts-ignore
                comp.compressData(entry);
                delete entry.components[id];
            }

            delete entry.components;
        }

        return data;
    }

    /**
     * Compresses serialized blueprint
     * @param {Array<Object>} data
     * @returns {Array<Object>}
     */
    static decompressSerializedData(data) {
        for (const entry of data) {
            const r = (entry.r & 0x0011) * 90;
            const or = ((entry.r & 0b1100) >> 2) * 90;
            const staticComp = {
                origin: { x: entry.x, y: entry.y },
                rotation: r,
                originalRotation: or,
                code: entry.c,
            };

            delete entry.x;
            delete entry.y;
            delete entry.c;
            delete entry.r;

            entry.components = {};
            for (const shortKey in entry) {
                if (shortKey == "components") continue;
                const componentID = gComponentRegistry.shortCodeToId(shortKey);
                const comp = gComponentRegistry.findById(componentID);
                // @ts-ignore
                comp.decompressData(entry);
                delete entry[shortKey];
            }

            entry.components.StaticMapEntity = staticComp;
            entry.uid = 0;
        }

        return data;
    }

    /**
     * Serializes blueprint and writes it on image and returns new data
     * @param {ImageData} image
     * @returns {ImageData}
     */
    serializeToImage(image) {
        const compressedData = this.serialize();
        const len = compressedData.length;
        const size = image.width * image.height;
        if (len + 4 > size) return null;

        for (let n = 0; n < 4 * 4; n++) {
            image.data[n] = (image.data[n] & 0xfc) + ((len >> (n * 2)) & 0x03);
        }

        for (let i = 0; i < len; i++) {
            const byte = compressedData[i];
            const idx = (i + 4) * 4;

            for (let n = 0; n < 4; n++) {
                image.data[idx + n] = (image.data[idx + n] & 0xfc) + ((byte >> (n * 2)) & 0x03);
            }
        }

        return image;
    }

    /**
     * Reads and deserializes the data within image
     * @param {GameRoot} root
     * @param {ImageData} image
     * @returns {Blueprint}
     */
    static deserializeFromImage(root, image) {
        let len = 0;
        for (let n = 0; n < 4 * 4; n++) {
            const bits = image.data[n] & 0x03;
            len += bits << (n * 2);
        }

        const size = image.width * image.height;
        assert(
            len + 4 < size,
            "Written length is bigger than image. Image could be corrupted or written badly!"
        );

        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            const idx = (i + 4) * 4;
            let num = 0;
            num += (image.data[idx + 0] & 0x03) << 0;
            num += (image.data[idx + 1] & 0x03) << 2;
            num += (image.data[idx + 2] & 0x03) << 4;
            num += (image.data[idx + 3] & 0x03) << 6;
            arr[i] = num;
        }

        const compressedData = JSON.parse(decompressU8WHeader(arr));
        const serializedData = Blueprint.decompressSerializedData(compressedData);
        return Blueprint.deserialize(root, serializedData);
    }

    /**
     * Creates a new blueprint from the given entity uids
     * @param {GameRoot} root
     * @param {Array<number>} uids
     */
    static fromUids(root, uids) {
        const newEntities = [];

        let averagePosition = new Vector();

        // First, create a copy
        for (let i = 0; i < uids.length; ++i) {
            const entity = root.entityMgr.findByUid(uids[i]);
            assert(entity, "Entity for blueprint not found:" + uids[i]);

            const clone = entity.clone();
            newEntities.push(clone);

            const pos = entity.components.StaticMapEntity.getTileSpaceBounds().getCenter();
            averagePosition.addInplace(pos);
        }

        averagePosition.divideScalarInplace(uids.length);
        const blueprintOrigin = averagePosition.subScalars(0.5, 0.5).floor();

        for (let i = 0; i < uids.length; ++i) {
            newEntities[i].components.StaticMapEntity.origin.subInplace(blueprintOrigin);
        }

        // Now, make sure the origin is 0,0
        return new Blueprint(newEntities);
    }

    /**
     * Returns the cost of this blueprint in shapes
     */
    getCost() {
        if (G_IS_DEV && globalConfig.debug.blueprintsNoCost) {
            return 0;
        }
        return findNiceIntegerValue(4 * Math.pow(this.entities.length, 1.1));
    }

    /**
     * Draws the blueprint at the given origin
     * @param {DrawParameters} parameters
     */
    draw(parameters, tile) {
        parameters.context.globalAlpha = 0.8;
        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;
            const newPos = staticComp.origin.add(tile);

            const rect = staticComp.getTileSpaceBounds();
            rect.moveBy(tile.x, tile.y);

            if (!parameters.root.logic.checkCanPlaceEntity(entity, tile)) {
                parameters.context.globalAlpha = 0.3;
            } else {
                parameters.context.globalAlpha = 1;
            }

            staticComp.drawSpriteOnBoundsClipped(parameters, staticComp.getBlueprintSprite(), 0, newPos);
        }
        parameters.context.globalAlpha = 1;
    }

    /**
     * Rotates the blueprint clockwise
     */
    rotateCw() {
        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;

            staticComp.rotation = (staticComp.rotation + 90) % 360;
            staticComp.originalRotation = (staticComp.originalRotation + 90) % 360;
            staticComp.origin = staticComp.origin.rotateFastMultipleOf90(90);
        }
    }

    /**
     * Rotates the blueprint counter clock wise
     */
    rotateCcw() {
        // Well ...
        for (let i = 0; i < 3; ++i) {
            this.rotateCw();
        }
    }

    /**
     * Checks if the blueprint can be placed at the given tile
     * @param {GameRoot} root
     * @param {Vector} tile
     */
    canPlace(root, tile) {
        let anyPlaceable = false;

        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            if (root.logic.checkCanPlaceEntity(entity, tile)) {
                anyPlaceable = true;
            }
        }

        return anyPlaceable;
    }

    /**
     * @param {GameRoot} root
     */
    canAfford(root) {
        return root.hubGoals.getShapesStoredByKey(root.gameMode.getBlueprintShapeKey()) >= this.getCost();
    }

    /**
     * Attempts to place the blueprint at the given tile
     * @param {GameRoot} root
     * @param {Vector} tile
     */
    tryPlace(root, tile) {
        return root.logic.performBulkOperation(() => {
            return root.logic.performImmutableOperation(() => {
                let count = 0;
                for (let i = 0; i < this.entities.length; ++i) {
                    const entity = this.entities[i];
                    if (!root.logic.checkCanPlaceEntity(entity, tile)) {
                        continue;
                    }

                    const clone = entity.clone();
                    clone.components.StaticMapEntity.origin.addInplace(tile);
                    root.logic.freeEntityAreaBeforeBuild(clone);
                    root.map.placeStaticEntity(clone);
                    root.entityMgr.registerEntity(clone);
                    count++;
                }

                root.signals.bulkAchievementCheck.dispatch(
                    ACHIEVEMENTS.placeBlueprint,
                    count,
                    ACHIEVEMENTS.placeBp1000,
                    count
                );

                return count !== 0;
            });
        });
    }
}
