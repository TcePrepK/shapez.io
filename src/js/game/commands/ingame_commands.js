import { globalConfig } from "../../core/config";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { Vector } from "../../core/vector";
import { defaultBuildingVariant } from "../meta_building";

export const say = function (text) {
    console.log(text);
};

export const placeBuilding = function ({
    x = 0,
    y = 0,
    building,
    variant = defaultBuildingVariant,
    rotation = 0,
    rotationVariant = 0,
}) {
    const placeable = globalConfig.root.logic.tryPlaceBuilding({
        origin: new Vector(x, y),
        rotation,
        rotationVariant,
        originalRotation: 0,
        building: gMetaBuildingRegistry.findById(building),
        variant,
    });
};
