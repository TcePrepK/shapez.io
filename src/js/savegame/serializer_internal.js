import { globalConfig } from "../core/config";
import { createLogger } from "../core/logging";
import { Vector } from "../core/vector";
import { getBuildingDataFromCode } from "../game/building_codes";
import { Entity } from "../game/entity";

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
     * @param {Array<Entity>} array
     * @returns {string|void}
     */
    deserializeEntityArray(array) {
        for (let i = 0; i < array.length; ++i) {
            this.deserializeEntity(array[i]);
        }
    }

    /**
     * @param {Entity} payload
     */
    deserializeEntity(payload) {
        const root = globalConfig.root;
        const staticData = payload.components.StaticMapEntity;
        assert(staticData, "entity has no static data");

        const code = staticData.code;
        const data = getBuildingDataFromCode(code);

        const metaBuilding = data.metaInstance;

        const entity = metaBuilding.createEntity({
            origin: Vector.fromSerializedObject(staticData.origin),
            rotation: staticData.rotation,
            originalRotation: staticData.originalRotation,
            rotationVariant: data.rotationVariant,
            variant: data.variant,
        });

        entity.uid = payload.uid;

        this.deserializeComponents(entity, payload.components);

        root.entityMgr.registerEntity(entity, payload.uid);
        root.map.placeStaticEntity(entity);
    }

    /////// COMPONENTS ////

    /**
     * Deserializes components of an entity
     * @param {Entity} entity
     * @param {Object.<string, any>} data
     * @returns {string|void}
     */
    deserializeComponents(entity, data) {
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

            const errorStatus = entity.components[componentId].deserialize(data[componentId]);
            if (errorStatus) {
                return errorStatus;
            }
        }
    }
}
