import { GameSystemWithFilter } from "../game_system_with_filter";
import { ButtonComponent } from "../components/button";
import { BOOL_TRUE_SINGLETON, BOOL_FALSE_SINGLETON } from "../items/boolean_item";
import { MapChunkView } from "../map_chunk_view";
import { Loader } from "../../core/loader";

export class ButtonSystem extends GameSystemWithFilter {
    constructor() {
        super([ButtonComponent]);

        this.spriteOn = Loader.getSprite("sprites/wires/lever_on.png");
        this.spriteOff = Loader.getSprite("sprites/buildings/lever.png");
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];

            const buttonComp = entity.components.Button;
            const pinsComp = entity.components.WiredPins;

            let toggled = buttonComp.toggled;
            if (buttonComp.lifeSpan == 0) {
                buttonComp.toggled = false;
            } else {
                buttonComp.lifeSpan--;
            }

            // Simply sync the status to the first slot
            pinsComp.slots[0].value = buttonComp.toggled ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
        }
    }

    /**
     * Draws a given chunk
     * @param {MapChunkView} chunk
     */
    drawChunk(chunk) {
        const contents = chunk.containedEntitiesByLayer.regular;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            const buttonComp = entity.components.Button;
            if (buttonComp) {
                const sprite = buttonComp.toggled ? this.spriteOn : this.spriteOff;
                entity.components.StaticMapEntity.drawSpriteOnBoundsClipped(sprite);
            }
        }
    }
}
