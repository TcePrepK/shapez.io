import { Vector } from "../../core/vector";
import { ObserverComponent } from "../components/observer";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON, BOOL_TRUE_SINGLETON } from "../items/boolean_item";

export class ObserverSystem extends GameSystemWithFilter {
    constructor() {
        super([ObserverComponent]);

        // this.root.signals.entityAdded.add(this.testEntity, this);
        // this.root.signals.entityChanged.add(this.testEntity, this);
        // this.root.signals.entityDestroyed.add(this.testEntity, this);
        // this.root.signals.entityQueuedForDestroy.add(this.testEntity, this);
    }

    update() {
        for (const entity of this.allEntities) {
            this.updateEntity(entity);
        }
    }

    /**
     * @param {Entity} entity
     */
    updateEntity(entity) {
        const observerComp = entity.components.Observer;

        if (!observerComp) {
            return;
        }

        entity.components.WiredPins.slots[0].value = BOOL_FALSE_SINGLETON;

        const staticComp = entity.components.StaticMapEntity;
        const origin = staticComp.origin;
        const rotation = staticComp.rotation;
        const neighboor = new Vector(0, -1).rotateInplaceFastMultipleOf90(rotation);
        const observedTile = origin.add(neighboor);
        const observedEntity = this.root.map.getLayerContentXY(observedTile.x, observedTile.y, "regular");

        const lastSeen = observerComp.lastSeen;
        const lastPosition = observerComp.lastPos;

        if (!lastPosition) {
            observerComp.lastSeen = observedEntity;
            observerComp.lastPos = origin.copy();
            return;
        }

        if (!lastPosition.equals(origin)) {
            observerComp.lastPos = origin.copy();
            entity.components.WiredPins.slots[0].value = BOOL_TRUE_SINGLETON;
            return;
        }

        if (observedEntity && lastSeen === null) {
            observerComp.lastSeen = observedEntity;
            entity.components.WiredPins.slots[0].value = BOOL_TRUE_SINGLETON;
            return;
        }

        if (!observedEntity && lastSeen !== null) {
            observerComp.lastSeen = null;
            entity.components.WiredPins.slots[0].value = BOOL_TRUE_SINGLETON;
            return;
        }

        if (observedEntity && lastSeen !== null && lastSeen !== observedEntity) {
            observerComp.lastSeen = observedEntity;
            entity.components.WiredPins.slots[0].value = BOOL_TRUE_SINGLETON;
            return;
        }
    }

    // /**
    //  * @param {Entity} entity
    //  */
    // testEntity(entity) {
    //     if (entity.components.Observer) {
    //         this.updateEntity(entity);
    //     }
    // }
}
