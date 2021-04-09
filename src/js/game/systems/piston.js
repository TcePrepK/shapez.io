import { GameSystemWithFilter } from "../game_system_with_filter";
import { enumStatusTypes, enumPistonTypes, PistonComponent } from "../components/piston";
import { Vector } from "../../core/vector";
import { BOOL_FALSE_SINGLETON } from "../items/boolean_item";
import { enumPistonVariants } from "../buildings/piston";
import { Entity } from "../entity";
import { getBuildingDataFromCode } from "../building_codes";
import { WiredPinsComponent } from "../components/wired_pins";
import { clamp, fastArrayDeleteValue } from "../../core/utils";
import { MapChunkView } from "../map_chunk_view";
import { globalConfig } from "../../core/config";
import { Loader } from "../../core/loader";

export class PistonSystem extends GameSystemWithFilter {
    constructor() {
        super([PistonComponent]);

        this.root.signals.entityDestroyed.add(this.removeEntity, this);

        this.fixRequired = true;
        this.pistonSprites = {
            [enumPistonTypes.regular]: {
                body: Loader.getSprite("sprites/buildings/piston_body.png"),
                head: Loader.getSprite("sprites/buildings/piston_regular_head.png"),
            },

            [enumPistonTypes.sticky]: {
                body: Loader.getSprite("sprites/buildings/piston_body.png"),
                head: Loader.getSprite("sprites/buildings/piston_sticky_head.png"),
            },
        };
    }

    /**
     * @param {Entity} entity
     */
    fixHead(entity) {
        const pistonComp = entity.components.Piston;
        if (!pistonComp) {
            return;
        }

        const staticComp = entity.components.StaticMapEntity;
        const rotation = staticComp.rotation;
        const pushVector = new Vector(0, -1).rotateInplaceFastMultipleOf90(rotation);
        const pullVector = pushVector.multiplyScalar(-1);

        if (pistonComp.status == enumStatusTypes.on) {
            entity.components.StaticMapEntity.moveOrigin(pushVector);
            this.root.map.placeStaticEntity(entity);
            entity.components.StaticMapEntity.moveOrigin(pullVector);
        } else if (pistonComp.status == enumStatusTypes.off) {
            entity.components.StaticMapEntity.moveOrigin(pushVector);
            this.root.map.removeStaticEntity(entity);
            entity.components.StaticMapEntity.moveOrigin(pullVector);
            this.root.map.placeStaticEntity(entity);
        }
    }

    /**
     * @param {Entity} entity
     */
    removeEntity(entity) {
        const pistonComp = entity.components.Piston;

        if (!pistonComp) {
            return;
        }

        const staticComp = entity.components.StaticMapEntity;
        const rotation = staticComp.rotation;
        const pushVector = new Vector(0, -1).rotateInplaceFastMultipleOf90(rotation);
        const pullVector = pushVector.multiplyScalar(-1);

        const otherOrigin = staticComp.origin.add(pushVector);
        const otherEntity = this.root.map.getLayerContentXY(otherOrigin.x, otherOrigin.y, entity.layer);

        if (!otherEntity) {
            return;
        }

        if (otherEntity !== entity) {
            return;
        }

        entity.components.StaticMapEntity.moveOrigin(pushVector);
        this.root.map.removeStaticEntity(entity);
        entity.components.StaticMapEntity.moveOrigin(pullVector);
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const pistonComp = entity.components.Piston;

            const pinsComp = entity.components.WiredPins;
            const slots = pinsComp.slots;

            let working = false;
            for (let j = 0; j < slots.length; j++) {
                const slot = slots[j];
                const network = slot.linkedNetwork;

                if (network && network.hasValue() && network.currentValue != BOOL_FALSE_SINGLETON) {
                    working = true;
                }
            }

            const staticComp = entity.components.StaticMapEntity;
            const rotation = staticComp.rotation;
            const origin = staticComp.origin;
            const pushVector = new Vector(0, -1).rotateInplaceFastMultipleOf90(rotation);
            const pullVector = pushVector.multiplyScalar(-1);

            if (working && pistonComp.status == enumStatusTypes.off) {
                // Set Status So We Don't Push/Pull This Entity
                pistonComp.status = enumStatusTypes.on;

                // Push Entity
                const neighborOrigin = origin.add(pushVector);
                const targetEntity = this.root.map
                    .getOrCreateChunkAtTile(neighborOrigin.x, neighborOrigin.y)
                    .getLayerContentFromWorldCoords(neighborOrigin.x, neighborOrigin.y, entity.layer);

                const pushed = this.root.map.moveStaticEntity(targetEntity, pushVector);

                // Fix Status
                pistonComp.status = enumStatusTypes.off;
                if (pushed) {
                    pistonComp.status = enumStatusTypes.on;
                    this.fixHead(entity);
                }
            } else if (!working && pistonComp.status == enumStatusTypes.on) {
                // Set Status So We Can Push/Pull This Entity
                pistonComp.status = enumStatusTypes.off;
                this.fixHead(entity);

                // Pull Entity
                if (pistonComp.type == enumPistonVariants.sticky) {
                    const staticComp = entity.components.StaticMapEntity;
                    const rotation = staticComp.rotation;
                    const origin = staticComp.origin;

                    const originVector = new Vector(0, -2).rotateInplaceFastMultipleOf90(rotation);
                    const neighborOrigin = origin.add(originVector);
                    const targetEntity = this.root.map
                        .getOrCreateChunkAtTile(neighborOrigin.x, neighborOrigin.y)
                        .getLayerContentFromWorldCoords(neighborOrigin.x, neighborOrigin.y, entity.layer);

                    if (targetEntity) {
                        this.root.map.moveStaticEntity(targetEntity, pullVector);
                    }
                }
            }
        }
    }

    /**
     * Draws a given chunk
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        const contents = chunk.contents;
        for (let y = 0; y < globalConfig.mapChunkSize; ++y) {
            for (let x = 0; x < globalConfig.mapChunkSize; ++x) {
                const entity = contents[x][y];
                if (entity && entity.components.Piston) {
                    const pistonComp = entity.components.Piston;
                    const pistonType = pistonComp.type;

                    // Calculating head span with in 0-10 instead of 0-1 because of floating points.
                    if (pistonComp.status == enumStatusTypes.on && pistonComp.headSpan <= 8) {
                        pistonComp.headSpan += 1;
                    } else if (pistonComp.status == enumStatusTypes.off && pistonComp.headSpan >= 1) {
                        pistonComp.headSpan -= 1;
                    }

                    // To be safe
                    clamp(pistonComp.headSpan, 0, 10);
                    const headSpan = pistonComp.headSpan / 10;

                    const staticComp = entity.components.StaticMapEntity;
                    const rotation = staticComp.rotation;
                    const pushVector = new Vector(0, -headSpan).rotateInplaceFastMultipleOf90(rotation);

                    const sprites = this.pistonSprites[pistonType];

                    staticComp.drawSpriteOnBoundsClipped(
                        sprites.head,
                        0,
                        null,
                        pushVector.multiplyScalar(globalConfig.tileSize),
                        0,
                        2 - 2 * headSpan
                    );
                    // }
                    staticComp.drawSpriteOnBoundsClipped(sprites.body);
                }
            }
        }
    }
}
