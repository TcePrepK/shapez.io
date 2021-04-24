import { gItemRegistry } from "../core/global_registries";
import { ShapeItem } from "./items/shape_item";
import { ColorItem } from "./items/color_item";
import { BooleanItem } from "./items/boolean_item";
import { TrashShapeItem } from "./items/trash_shape";
import { TrashColorItem } from "./items/trash_color";
import { TrashBooleanItem } from "./items/trash_boolean";

export function initItemRegistry() {
    gItemRegistry.register(ShapeItem);
    gItemRegistry.register(ColorItem);
    gItemRegistry.register(BooleanItem);
    gItemRegistry.register(TrashShapeItem);
    gItemRegistry.register(TrashColorItem);
    gItemRegistry.register(TrashBooleanItem);
}
