import { globalConfig } from "../../core/config";
import { TrashComponent } from "../components/trash";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { MapChunkView } from "../map_chunk_view";

export class TrashSystem extends GameSystemWithFilter {
    constructor() {
        super([TrashComponent]);
    }

    /**
     * Draws a given chunk
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity && entity.components.Trash) {
                const trashList = entity.components.Trash.trashList;
                const origin = entity.components.StaticMapEntity.origin.multiplyScalar(globalConfig.tileSize);
                for (const item of trashList) {
                    item.drawItemCenteredImpl(origin.x, origin.y, globalConfig.defaultItemDiameter);
                }
            }
        }
    }
}
