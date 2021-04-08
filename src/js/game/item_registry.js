import { gItemRegistry } from "../core/global_registries";
import { ShapeItem } from "./items/shape_item";
import { ColorItem } from "./items/color_item";
import { BooleanItem } from "./items/boolean_item";
import { ColoredItem } from "./items/colored_item";

export function initItemRegistry() {
    gItemRegistry.register(ShapeItem);
    gItemRegistry.register(ColorItem);
    gItemRegistry.register(BooleanItem);
    gItemRegistry.register(ColoredItem);
}
