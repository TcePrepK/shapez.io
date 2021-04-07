import { enumDirection, Vector } from "../../core/vector";
import { StickyComponent } from "../components/sticky";
import { Entity } from "../entity";
import { MetaBuilding } from "../meta_building";

export class MetaStickyTileBuilding extends MetaBuilding {
    constructor() {
        super("sticky_tile");
    }

    getDimensions() {
        return new Vector(1, 1);
    }

    getSilhouetteColor() {
        return "#000000";
    }

    getIsUnlocked() {
        return true;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new StickyComponent([new Vector(1, 0), new Vector(0, 1), new Vector(-1, 0), new Vector(0, -1)])
        );
    }
}
