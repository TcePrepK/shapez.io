import { globalConfig } from "../core/config";
import { gComponentRegistry } from "../core/global_registries";
import { createLogger } from "../core/logging";
import { Vector } from "../core/vector";
import { MetaConstantSignalBuilding } from "../game/buildings/constant_signal";
import { getBuildingDataFromCode } from "../game/building_codes";
import { ConstantSignalComponent } from "../game/components/constant_signal";
import { Entity } from "../game/entity";
import { GameRoot } from "../game/root";

const logger = createLogger("serializer_internal");

// Internal serializer methods
export class SerializerInternal {
    /**
     * Serializes an array of entities
     * @param {Array<Entity>} array
     */
    serializeEntityArray(array) {
        const serialized = [];
        for (let i = 0; i < array.length; ++i) {
            const entity = array[i];
            if (!entity.queuedForDestroy && !entity.destroyed) {
                serialized.push(entity.serialize());
            }
        }
        return serialized;
    }

    /**
     * @param {GameRoot} root
     * @param {Array<Entity>} array
     * @returns {string|void}
     */
    deserializeEntityArray(root, array) {
        for (let i = 0; i < array.length; ++i) {
            const serializedEntity = array[i];
            const result = this.deserializeEntity(root, serializedEntity);
            if (typeof result === "string") {
                return result;
            }
            result.uid = serializedEntity.uid;
            root.entityMgr.registerEntity(result, serializedEntity.uid);
            root.map.placeStaticEntity(result);
        }
    }

    /**
     * @param {GameRoot} root
     * @param {Entity} payload
     * @returns {string|Entity}
     */
    deserializeEntity(root, payload) {
        const staticData = payload.components.StaticMapEntity;
        assert(staticData, "entity has no static data");

        const code = staticData.code;
        const data = getBuildingDataFromCode(code);

        const metaBuilding = data.metaInstance;

        const entity = metaBuilding.createEntity({
            root,
            origin: Vector.fromSerializedObject(staticData.origin),
            rotation: staticData.rotation,
            originalRotation: staticData.originalRotation,
            rotationVariant: data.rotationVariant,
            variant: data.variant,
        });

        const errorStatus = this.deserializeComponents(root, entity, payload.components);

        return errorStatus || entity;
    }

    /**
     * @param {GameRoot} root
     * @param {Object} payload
     * @returns {string|Entity}
     */
    deserializeCompressedEntity(root, payload) {
        console.log(payload);
        assert(payload.c != undefined, "Entity has no code");
        assert(payload.x != undefined && payload.y != undefined, "Entity has no location");
        assert(payload.r != undefined, "Entity has no rotation");

        const data = getBuildingDataFromCode(payload.c);
        const metaBuilding = data.metaInstance;

        const rotation = payload.r >> 2;
        const originalRotation = (payload.r - (payload.r >> 2)) >> 2;
        const entity = metaBuilding.createEntity({
            root,
            origin: new Vector(payload.x, payload.y),
            rotation,
            originalRotation,
            rotationVariant: data.rotationVariant,
            variant: data.variant,
        });

        delete payload.c;
        delete payload.x;
        delete payload.y;
        delete payload.r;
        delete payload.or;

        const errorStatus = this.deserializeCompressedComponents(root, entity, payload);

        return errorStatus || entity;
    }

    /////// COMPONENTS ////

    /**
     * Deserializes components of an entity
     * @param {GameRoot} root
     * @param {Entity} entity
     * @param {Object.<string, any>} data
     * @returns {string|void}
     */
    deserializeComponents(root, entity, data) {
        for (const componentId in data) {
            if (!entity.components[componentId]) {
                if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts) {
                    // @ts-ignore
                    if (++window.componentWarningsShown < 100) {
                        logger.warn("Entity no longer has component:", componentId);
                    }
                }
                continue;
            }

            const errorStatus = entity.components[componentId].deserialize(data[componentId], root);
            if (errorStatus) {
                return errorStatus;
            }
        }
    }

    /**
     * Deserializes components of an entity
     * @param {GameRoot} root
     * @param {Entity} entity
     * @param {Object.<string, any>} data
     * @returns {string|void}
     */
    deserializeCompressedComponents(root, entity, data) {
        for (const componentCode in data) {
            const componentId = gComponentRegistry.shortCodeToId(componentCode);
            if (!entity.components[componentId]) {
                if (G_IS_DEV && !globalConfig.debug.disableSlowAsserts) {
                    // @ts-ignore
                    if (++window.componentWarningsShown < 100) {
                        logger.warn("Entity no longer has component:", componentId);
                    }
                }
                continue;
            }

            const errorStatus = entity.components[componentId].deserialize(data[componentId], root);
            if (errorStatus) {
                return errorStatus;
            }
        }
    }
}
