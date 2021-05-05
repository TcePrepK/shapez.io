import { gItemRegistry } from "../core/global_registries";
import { BooleanItem } from "./items/boolean_item";
import { ColorItem } from "./items/color_item";
import { NumberItem } from "./items/number_item";
import { ShapeItem } from "./items/shape_item";

export function initItemRegistry() {
    gItemRegistry.register(ShapeItem);
    gItemRegistry.register(ColorItem);
    gItemRegistry.register(BooleanItem);
    gItemRegistry.register(NumberItem);
}
