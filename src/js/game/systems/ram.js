import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON } from "../items/boolean_item";
import { RamComponent } from "../components/ram";

export class RamSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [RamComponent]);
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const pinsComp = entity.components.WiredPins;
            const network = pinsComp.slots[1].linkedNetwork;
            if (!network) {
                continue;
            }

            const value = network.currentValue;
            if (value) {
                pinsComp.slots[0].value = value;
            }
        }
    }
}
