import { globalConfig } from "../../core/config";
import { TrashComponent } from "../components/trash";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";

export class TrashSystem extends GameSystemWithFilter {
    constructor() {
        super([TrashComponent]);
    }

    update() {
        for (const entity of this.allEntities) {
            const trashComp = entity.components.Trash;
            const fallingList = trashComp.fallingList;

            for (const trash of fallingList) {
                trash.updateFalling();
                if (trash.falling >= 0) {
                    fallingList.splice(fallingList.indexOf(trash), 1);
                }
            }
        }
    }

    /**
     * Draws a given chunk
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (const entity of contents) {
            if (!entity.components.Trash) {
                continue;
            }

            const trashList = entity.components.Trash.trashList;
            const origin = entity.components.StaticMapEntity.origin.multiplyScalar(globalConfig.tileSize);
            for (const trash of trashList) {
                trash.drawItemCenteredImpl(origin.x, origin.y, globalConfig.defaultItemDiameter);
            }
        }
    }
}
