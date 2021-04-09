import { globalConfig } from "../../core/config";
import { Vector } from "../../core/vector";
import { ExplosiveComponent } from "../components/explosive";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON } from "../items/boolean_item";
import { MapChunkView } from "../map_chunk_view";

export class ExplosiveSystem extends GameSystemWithFilter {
    constructor() {
        super([ExplosiveComponent]);
    }

    update() {
        for (const entity of this.allEntities) {
            const explosiveComp = entity.components.Explosive;

            if (!explosiveComp) {
                continue;
            }

            const slots = entity.components.WiredPins.slots;
            for (const slot of slots) {
                const network = slot.linkedNetwork;

                if (!network) {
                    continue;
                }

                const value = network.currentValue;

                if (!value || value === BOOL_FALSE_SINGLETON) {
                    continue;
                }

                explosiveComp.explode = true;
                break;
            }
        }
    }

    /**
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        const parameters = globalConfig.parameters;
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const explosiveComp = entity.components.Explosive;

            // console.log(entity.components.Explosive);
            if (!explosiveComp) {
                continue;
            }

            // console.log("lifeSpan");
            if (!explosiveComp.explode) {
                continue;
            }

            const lifeSpan = explosiveComp.lifeSpan;

            if (lifeSpan < 10) {
                explosiveComp.lifeSpan += 1;
            }

            if (lifeSpan === 10) {
                const origin = entity.components.StaticMapEntity.origin;
                const ctx = parameters.context;

                const size = globalConfig.tileSize;
                const pos = origin.multiplyScalar(size);

                const power = 4;
                // const radius = 2 * power;

                // console.log("smt");

                // console.log(-radius);
                // console.log(new Vector(-radius / 2, radius / 2).length());
                // console.log((0.7 + 0.6) * power);
                // console.log("-----------------------");
                for (let x = -power * 1.5; x < power * 1.5; x++) {
                    for (let y = -power * 1.5; y < power * 1.5; y++) {
                        const offX = x * size;
                        const offY = y * size;

                        const tile = new Vector(origin.x + x, origin.y + y);
                        const tileXsize = new Vector(pos.x + offX, pos.y + offY);
                        const dist = new Vector(offX + size / 2, offY + size / 2).length();
                        const rNumber = (Math.random() * 6) / 10;

                        const maxDist = (0.7 + rNumber) * power;

                        if (dist > maxDist * size) {
                            continue;
                        }

                        const otherEntity = this.root.map.getTileContent(tile, entity.layer);
                        // console.log(otherEntity);

                        if (otherEntity) {
                            this.root.logic.tryDeleteBuilding(otherEntity);
                        }

                        // console.log(tile);
                        ctx.translate(tileXsize.x + size / 4, tileXsize.y + size / 4);

                        ctx.fillStyle = "blue";
                        ctx.fillRect(0, 0, size / 2, size / 2);

                        ctx.translate(-(tileXsize.x + size / 4), -(tileXsize.y + size / 4));
                    }
                }
            }
        }
    }
}
