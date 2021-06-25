import { types } from "../savegame/serialization";
import { gItemRegistry } from "../core/global_registries";
import { BooleanItem, BOOL_TRUE_SINGLETON, BOOL_FALSE_SINGLETON } from "./items/boolean_item";
import { ShapeItem } from "./items/shape_item";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "./items/color_item";
import { enumColors } from "./colors";
import { ShapeDefinition } from "./shape_definition";

/**
 * Resolves items so we share instances
 * @param {import("../savegame/savegame_serializer").GameRoot} root
 * @param {{$: string, data: any }} data
 */
export function itemResolverSingleton(root, data) {
    const itemType = data.$;
    const itemData = data.data;

    switch (itemType) {
        case BooleanItem.getId(): {
            return itemData ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
        }
        case ShapeItem.getId(): {
            return root.shapeDefinitionMgr.getShapeItemFromShortKey(itemData);
        }
        case ColorItem.getId(): {
            return COLOR_ITEM_SINGLETONS[itemData];
        }

        default: {
            assertAlways(false, "Unknown item type: " + itemType);
        }
    }
}

/**
 * Resolves items without type so we share instances
 * @param {any} data
 */
export function typeResolverSingleton(data) {
    if (data == 0 || data == 1) return BooleanItem.getId();
    if (Object.keys(enumColors).includes(data)) return ColorItem.getId();
    if (ShapeDefinition.isValidShortKeyInternal(data)) return ShapeItem.getId();
    assertAlways(false, "Unknown item: " + data);
}

export const typeItemSingleton = types.obj(gItemRegistry, itemResolverSingleton);
