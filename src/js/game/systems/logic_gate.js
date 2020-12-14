import { parseJsonText } from "typescript";
import { parse } from "yaml";
import { boolOptions } from "yaml/types";
import { RandomNumberGenerator } from "../../core/rng";
import { enumDirectionToAngle, Vector } from "../../core/vector";
import { BaseItem } from "../base_item";
import {
    enumColors,
    enumColorToOctal,
    enumColorToShortcode,
    enumOctalToColor,
    enumShortcodeToColor,
} from "../colors";
import { enumLogicGateType, LogicGateComponent } from "../components/logic_gate";
import { enumPinSlotType } from "../components/wired_pins";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_FALSE_SINGLETON, BOOL_TRUE_SINGLETON, BooleanItem, isTruthyItem } from "../items/boolean_item";
import { ColorItem, COLOR_ITEM_SINGLETONS } from "../items/color_item";
import { ShapeItem } from "../items/shape_item";
import { MapChunkView } from "../map_chunk_view";
import { ShapeDefinition } from "../shape_definition";
import { createLogger } from "../../core/logging";

/** @type {Object<ItemType, number>} */
const enumTypeToSize = {
    boolean: 9,
    shape: 14,
    color: 14,
};

export class LogicGateSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [LogicGateComponent]);

        this.boundOperations = {
            [enumLogicGateType.and]: this.compute_AND.bind(this),
            [enumLogicGateType.not]: this.compute_NOT.bind(this),
            [enumLogicGateType.xor]: this.compute_XOR.bind(this),
            [enumLogicGateType.or]: this.compute_OR.bind(this),
            [enumLogicGateType.transistor]: this.compute_IF.bind(this),

            [enumLogicGateType.rotater]: this.compute_ROTATE.bind(this),
            [enumLogicGateType.analyzer]: this.compute_ANALYZE.bind(this),
            [enumLogicGateType.cutter]: this.compute_CUT.bind(this),
            [enumLogicGateType.unstacker]: this.compute_UNSTACK.bind(this),
            [enumLogicGateType.compare]: this.compute_COMPARE.bind(this),
            [enumLogicGateType.stacker]: this.compute_STACKER.bind(this),
            [enumLogicGateType.painter]: this.compute_PAINTER.bind(this),

            [enumLogicGateType.math]: this.compute_MATH.bind(this),
            [enumLogicGateType.smart_stacker]: this.compute_smart_STACKER.bind(this),
        };
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const logicComp = entity.components.LogicGate;
            const slotComp = entity.components.WiredPins;

            const slotValues = [];

            // Store if any conflict was found
            let anyConflict = false;

            // Gather inputs from all connected networks
            for (let i = 0; i < slotComp.slots.length; ++i) {
                const slot = slotComp.slots[i];
                if (slot.type !== enumPinSlotType.logicalAcceptor) {
                    continue;
                }
                const network = slot.linkedNetwork;
                if (network) {
                    if (network.valueConflict) {
                        anyConflict = true;
                        break;
                    }
                    slotValues.push(network.currentValue);
                } else {
                    slotValues.push(null);
                }
            }

            // Handle conflicts
            if (anyConflict) {
                for (let i = 0; i < slotComp.slots.length; ++i) {
                    const slot = slotComp.slots[i];
                    if (slot.type !== enumPinSlotType.logicalEjector) {
                        continue;
                    }
                    slot.value = null;
                }
                continue;
            }

            // Compute actual result
            const result = this.boundOperations[logicComp.type](
                slotValues,
                logicComp.operation,
                logicComp.difficulty
            );

            if (Array.isArray(result)) {
                let resultIndex = 0;
                for (let i = 0; i < slotComp.slots.length; ++i) {
                    const slot = slotComp.slots[i];
                    if (slot.type !== enumPinSlotType.logicalEjector) {
                        continue;
                    }
                    slot.value = result[resultIndex++];
                }
            } else {
                // @TODO: For now we hardcode the value to always be slot 0
                assert(
                    slotValues.length === slotComp.slots.length - 1,
                    "Bad slot config, should have N acceptor slots and 1 ejector"
                );
                assert(slotComp.slots[0].type === enumPinSlotType.logicalEjector, "Slot 0 should be ejector");
                slotComp.slots[0].value = result;
            }
        }
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_AND(parameters) {
        assert(parameters.length === 2, "bad parameter count for AND");
        return isTruthyItem(parameters[0]) && isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_NOT(parameters) {
        return isTruthyItem(parameters[0]) ? BOOL_FALSE_SINGLETON : BOOL_TRUE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_XOR(parameters) {
        assert(parameters.length === 2, "bad parameter count for XOR");
        return isTruthyItem(parameters[0]) !== isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_OR(parameters) {
        assert(parameters.length === 2, "bad parameter count for OR");
        return isTruthyItem(parameters[0]) || isTruthyItem(parameters[1])
            ? BOOL_TRUE_SINGLETON
            : BOOL_FALSE_SINGLETON;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_IF(parameters) {
        assert(parameters.length === 2, "bad parameter count for IF");
        const flag = parameters[0];
        const value = parameters[1];

        // pass through item
        if (isTruthyItem(flag)) {
            return value;
        }

        return null;
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_ROTATE(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return null;
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const rotatedDefinitionCW = this.root.shapeDefinitionMgr.shapeActionRotateCW(definition);
        return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(rotatedDefinitionCW);
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_ANALYZE(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const lowerLayer = /** @type {import("../shape_definition").ShapeLayer} */ (definition.layers[0]);
        if (!lowerLayer) {
            return [null, null];
        }

        const topRightContent = lowerLayer[0];

        if (!topRightContent || topRightContent.subShape === null) {
            return [null, null];
        }

        const newDefinition = new ShapeDefinition({
            layers: [
                [
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                    { subShape: topRightContent.subShape, color: enumColors.uncolored },
                ],
            ],
        });

        return [
            COLOR_ITEM_SINGLETONS[topRightContent.color],
            this.root.shapeDefinitionMgr.getShapeItemFromDefinition(newDefinition),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_CUT(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const result = this.root.shapeDefinitionMgr.shapeActionCutHalf(definition);
        return [
            result[0].isEntirelyEmpty()
                ? null
                : this.root.shapeDefinitionMgr.getShapeItemFromDefinition(result[0]),
            result[1].isEntirelyEmpty()
                ? null
                : this.root.shapeDefinitionMgr.getShapeItemFromDefinition(result[1]),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {[BaseItem, BaseItem]}
     */
    compute_UNSTACK(parameters) {
        const item = parameters[0];
        if (!item || item.getItemType() !== "shape") {
            // Not a shape
            return [null, null];
        }

        const definition = /** @type {ShapeItem} */ (item).definition;
        const layers = /** @type {Array<import("../shape_definition").ShapeLayer>}  */ (definition.layers);

        const upperLayerDefinition = new ShapeDefinition({
            layers: [layers[layers.length - 1]],
        });

        const lowerLayers = layers.slice(0, layers.length - 1);
        const lowerLayerDefinition =
            lowerLayers.length > 0 ? new ShapeDefinition({ layers: lowerLayers }) : null;

        return [
            lowerLayerDefinition
                ? this.root.shapeDefinitionMgr.getShapeItemFromDefinition(lowerLayerDefinition)
                : null,
            this.root.shapeDefinitionMgr.getShapeItemFromDefinition(upperLayerDefinition),
        ];
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_STACKER(parameters) {
        const lowerItem = parameters[0];
        const upperItem = parameters[1];

        if (!lowerItem || !upperItem) {
            // Empty
            return null;
        }

        if (lowerItem.getItemType() !== "shape" || upperItem.getItemType() !== "shape") {
            // Bad type
            return null;
        }

        const stackedShape = this.root.shapeDefinitionMgr.shapeActionStack(
            /** @type {ShapeItem} */ (lowerItem).definition,
            /** @type {ShapeItem} */ (upperItem).definition
        );

        return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(stackedShape);
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_smart_STACKER(parameters) {
        const lowerItem = parameters[0];
        const upperItem = parameters[1];

        if (lowerItem && !upperItem) {
            if (lowerItem.getItemType() == "shape") {
                return lowerItem;
            } else {
                return null;
            }
        } else if (!lowerItem && upperItem) {
            if (upperItem.getItemType() == "shape") {
                return upperItem;
            } else {
                return null;
            }
        } else if (!lowerItem && !upperItem) {
            return null;
        } else {
            if (lowerItem.getItemType() !== "shape" || upperItem.getItemType() !== "shape") {
                // Bad type
                return null;
            }

            const stackedShape = this.root.shapeDefinitionMgr.shapeActionStack(
                /** @type {ShapeItem} */ (lowerItem).definition,
                /** @type {ShapeItem} */ (upperItem).definition
            );

            return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(stackedShape);
        }
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_PAINTER(parameters) {
        const shape = parameters[0];
        const color = parameters[1];

        if (!shape || !color) {
            // Empty
            return null;
        }

        if (shape.getItemType() !== "shape" || color.getItemType() !== "color") {
            // Bad type
            return null;
        }

        const coloredShape = this.root.shapeDefinitionMgr.shapeActionPaintWith(
            /** @type {ShapeItem} */ (shape).definition,
            /** @type {ColorItem} */ (color).color
        );

        return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(coloredShape);
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @returns {BaseItem}
     */
    compute_COMPARE(parameters) {
        const itemA = parameters[0];
        const itemB = parameters[1];

        if (!itemA || !itemB) {
            // Empty
            return null;
        }

        if (itemA.getItemType() !== itemB.getItemType()) {
            // Not the same type
            return BOOL_FALSE_SINGLETON;
        }

        switch (itemA.getItemType()) {
            case "shape": {
                return /** @type {ShapeItem} */ (itemA).definition.getHash() ===
                    /** @type {ShapeItem} */ (itemB).definition.getHash()
                    ? BOOL_TRUE_SINGLETON
                    : BOOL_FALSE_SINGLETON;
            }
            case "color": {
                return /** @type {ColorItem} */ (itemA).color === /** @type {ColorItem} */ (itemB).color
                    ? BOOL_TRUE_SINGLETON
                    : BOOL_FALSE_SINGLETON;
            }

            case "boolean": {
                return /** @type {BooleanItem} */ (itemA).value === /** @type {BooleanItem} */ (itemB).value
                    ? BOOL_TRUE_SINGLETON
                    : BOOL_FALSE_SINGLETON;
            }

            default: {
                assertAlways(false, "Bad item type: " + itemA.getItemType());
            }
        }
    }

    /**
     * @param {Array<BaseItem|null>} parameters
     * @param {string=} operation
     * @param {string=} difficulty
     */
    compute_MATH(parameters, operation, difficulty) {
        let itemA = parameters[0];
        let itemB = parameters[1];

        if (difficulty == "basic") {
            if (!itemA || !itemB) {
                // Empty
                return null;
            }
        } else {
            if (!itemA) {
                // Empty
                return null;
            }

            itemB = itemA;
        }

        if (itemA.getItemType() != itemB.getItemType()) {
            return null;
        }

        if (itemA.getAsCopyableKey().length > 16 + 1 || itemB.getAsCopyableKey().length > 16 + 1) {
            return null;
        }

        const valueA = itemA.getAsCopyableKey();
        const valueB = itemB.getAsCopyableKey();

        if (itemA.getItemType() === "color") {
            const numberA = enumColorToOctal[valueA].valueOf();
            const numberB = enumColorToOctal[valueB].valueOf();

            let resNum = this.compute_basic_MATH(numberA, numberB, operation);

            if (typeof resNum != "string") {
                return resNum;
            }

            // If number is outputable via color, output via color otherwise use shapez
            if (parseInt(resNum) <= 7) {
                return COLOR_ITEM_SINGLETONS[enumOctalToColor[resNum]];
            } else {
                const shape = this.generateShapeWithNumber(resNum, false, numberA, numberB, operation);

                if (!shape) {
                    return null;
                }

                const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shape);
                return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(definition);
            }
        } else {
            const partsA = valueA.split(":");
            const partsB = valueB.split(":");

            if (partsA.length > 2 || partsB.length > 2) {
                return null;
            }

            // Found numberA
            let numberA = "";
            const layerA = partsA.join("");
            for (let j = 0; j < layerA.length / 2; ++j) {
                let colorA = layerA[2 * j + 1];

                if (colorA == "-") {
                    colorA = "u";
                }

                const valueA = enumColorToOctal[enumShortcodeToColor[colorA]];

                numberA += valueA;

                if (
                    (layerA[2 * j] == "C" || layerA[2 * j] == "R") &&
                    (layerA[2 * j + 2] == "S" || layerA[2 * j + 2] == "W")
                ) {
                    numberA += ".";
                }
            }

            // Found numberB
            let numberB = "";
            const layerB = partsB.join("");
            for (let j = 0; j < layerB.length / 2; ++j) {
                let colorB = layerB[2 * j + 1];

                if (colorB == "-") {
                    colorB = "u";
                }

                const valueB = enumColorToOctal[enumShortcodeToColor[colorB]];

                numberB += valueB;

                if (
                    (layerB[2 * j] == "C" || layerB[2 * j] == "R") &&
                    (layerB[2 * j + 2] == "S" || layerB[2 * j + 2] == "W")
                ) {
                    numberB += ".";
                }
            }

            if (operation == "division" && (numberB == "0000" || numberB == "00000000")) {
                return null;
            }

            // Found last layer
            const lastLayerA = partsA[partsA.length - 1];
            const lastLayerB = partsB[partsB.length - 1];

            // Found last corner shape
            const lastShapeA = lastLayerA[lastLayerA.length - 2];
            const lastShapeB = lastLayerB[lastLayerB.length - 2];

            // If it is rectangle it is negative
            if (lastShapeA == "R" || lastShapeA == "W") {
                numberA = "-" + numberA;
            }

            if (lastShapeB == "R" || lastShapeB == "W") {
                numberB = "-" + numberB;
            }

            const layerPartsA = lastLayerA.split(".");
            const layerPartsB = lastLayerB.split(".");
            // If it is rectangle it is negative
            if (operation == "powerof" && (layerPartsA.length > 1 || layerPartsB.length > 1)) {
                return null;
            }

            // Found real number just for sign
            let resNum = this.compute_basic_MATH(numberA, numberB, operation);

            if (resNum === null || resNum == "NaN") {
                return null;
            }

            if (resNum == "Infinity" || resNum == "-Infinity") {
                return BOOL_TRUE_SINGLETON;
            }

            if (typeof resNum != "string") {
                return resNum;
            }

            // Test sign
            let negative = false;
            if (resNum[0] == "-") {
                negative = true;
                resNum = resNum.slice(1);
            }

            const shape = this.generateShapeWithNumber(resNum, negative, numberA, numberB, operation);

            if (!shape) {
                return null;
            }

            const definition = this.root.shapeDefinitionMgr.getShapeFromShortKey(shape);
            return this.root.shapeDefinitionMgr.getShapeItemFromDefinition(definition);
        }
    }

    /**
     * @param {string} numberA
     * @param {string} numberB
     * @param {string=} operation
     */
    compute_basic_MATH(numberA, numberB, operation) {
        let resNum;

        let a = parseFloat(numberA).toString();
        let b = parseFloat(numberB).toString();

        let lenghtA = a.split(".")[0].length;
        let lenghtB = b.split(".")[0].length;

        let pureA = parseFloat(numberA.split(".").join("")).toString();
        let pureB = parseFloat(numberB.split(".").join("")).toString();

        let negativeA = false;
        let negativeB = false;

        if (pureA[0] == "-") {
            negativeA = true;
            pureA = pureA.slice(1);
            lenghtA -= 1;
        }

        if (pureB[0] == "-") {
            negativeB = true;
            pureB = pureB.slice(1);
            lenghtB -= 1;
        }

        let fixedA = 0;
        for (let i = 0; i < pureA.length; ++i) {
            const digit = pureA[i];

            fixedA += Number(digit) * Math.pow(8, lenghtA - 1 - i);
        }

        let fixedB = 0;
        for (let i = 0; i < pureB.length; ++i) {
            const digit = pureB[i];

            fixedB += Number(digit) * Math.pow(8, lenghtB - 1 - i);
        }

        if (negativeA) {
            fixedA *= -1;
        }

        if (negativeB) {
            fixedB *= -1;
        }

        switch (operation) {
            case "addition":
                resNum = parseFloat((fixedA + fixedB).toFixed(4)).toString(8);
                break;
            case "subtraction":
                resNum = parseFloat((fixedA - fixedB).toFixed(4)).toString(8);
                break;
            case "multiplication":
                resNum = parseFloat((fixedA * fixedB).toFixed(4)).toString(8);
                break;
            case "division":
                resNum = parseFloat((fixedA / fixedB).toFixed(4)).toString(8);
                break;
            case "modulo":
                resNum = parseFloat((fixedA % fixedB).toFixed(4)).toString(8);
                break;
            case "powerof":
                resNum = parseFloat(Math.pow(fixedA, fixedB).toFixed(4)).toString(8);
                break;
            case "cos":
                resNum = parseFloat(Math.cos((fixedA * Math.PI) / 180).toFixed(4)).toString(8);
                break;
            case "cot":
                resNum = parseFloat((1 / Math.tan((fixedA * Math.PI) / 180)).toFixed(4)).toString(8);
                break;
            case "csc":
                resNum = parseFloat((1 / Math.sin((fixedA * Math.PI) / 180)).toFixed(4)).toString(8);
                break;
            case "log":
                resNum = parseFloat(Math.log((fixedA * Math.PI) / 180).toFixed(4)).toString(8);
                break;
            case "sec":
                resNum = parseFloat((1 / Math.cos((fixedA * Math.PI) / 180)).toFixed(4)).toString(8);
                break;
            case "sin":
                resNum = parseFloat(Math.sin((fixedA * Math.PI) / 180).toFixed(4)).toString(8);
                break;
            case "sqrt":
                resNum = parseFloat(Math.sqrt(fixedA).toFixed(4)).toString(8);
                break;
            case "tan":
                resNum = parseFloat(Math.tan((fixedA * Math.PI) / 180).toFixed(4)).toString(8);
                break;
            case "greater":
                return fixedA > fixedB ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
            case "less":
                return fixedA < fixedB ? BOOL_TRUE_SINGLETON : BOOL_FALSE_SINGLETON;
            default:
                resNum = null;
                break;
        }

        if (resNum.split(".") && Number(resNum.split(".")[1]) == 0) {
            resNum = resNum.split(".")[0];
        }

        if (resNum.split(".")[1]) {
            resNum = resNum.split(".")[0] + "." + resNum.split(".")[1].slice(0, 4);
        }

        if (resNum.split(".")[1]) {
            while (resNum.split(".")[1].length < 4) {
                resNum += "0";
            }
        }

        return resNum;
    }

    /**
     * Generates shape code from the givin number
     * @param {string} resNum
     * @param {boolean} negative
     */
    generateShapeWithNumber(resNum, negative, numberA, numberB, operation) {
        // Find floating num
        const parts = resNum.split(".");
        let floating = false;
        let floatingNum;
        if (parts.length > 1) {
            floating = true;
            floatingNum = parts[1].length;
            resNum = parts.join("");
        }

        if (resNum.length < 4) {
            // Make result same lenght as shapez
            while (resNum.length < 4) {
                resNum = "0" + resNum;
            }
        } else if (resNum.length > 4 && resNum.length < 8) {
            while (resNum.length < 8) {
                resNum = "0" + resNum;
            }
        } else if (resNum.length > 8 && resNum.length < 12) {
            while (resNum.length < 12) {
                resNum = "0" + resNum;
            }
        } else if (resNum.length > 12 && resNum.length < 16) {
            while (resNum.length < 16) {
                resNum = "0" + resNum;
            }
        } else if (resNum.length > 16) {
            if (resNum.split(".").length > 1) {
                const a = resNum.slice(1, resNum.split(".")[1].length);
            } else {
                return null;
            }
        }

        // Find and return final shape
        let shape = "";
        let point = false;
        for (let j = 0; j < resNum.length; ++j) {
            const number = resNum[j];
            const color = enumColorToShortcode[enumOctalToColor[number]];

            assert(
                color,
                "Illegal number! You have tried " +
                    operation +
                    " operation on these 2 numbers: " +
                    numberA +
                    " and " +
                    numberB
            );

            // Test is it floating or not
            if (floating && resNum.length - j <= floatingNum) {
                point = true;
            }

            if (j < resNum.length) {
                if (!point) {
                    if (!negative) {
                        shape += "C" + color;
                    } else {
                        shape += "R" + color;
                    }
                } else {
                    if (!negative) {
                        shape += "S" + color;
                    } else {
                        shape += "W" + color;
                    }
                }
            }

            if ((j + 1) % 4 == 0 && j != resNum.length - 1) {
                shape += ":";
            }
        }
        return shape;
    }

    /**
     * Draws a given chunk
     * @param {import("../../core/draw_utils").DrawParameters} parameters
     * @param {MapChunkView} chunk
     */
    drawWiresChunk(parameters, chunk) {
        const contents = chunk.containedEntitiesByLayer.wires;
        for (let i = 0; i < contents.length; ++i) {
            const entity = contents[i];
            if (entity.components.LogicGate && entity.components.LogicGate.type == enumLogicGateType.math) {
                const staticComp = entity.components.StaticMapEntity;
                const slot = entity.components.WiredPins.slots[0];
                const tile = staticComp.localTileToWorld(slot.pos);
                const worldPos = tile.toWorldSpaceCenterOfTile();
                const effectiveRotation = Math.radians(
                    staticComp.rotation + enumDirectionToAngle[slot.direction]
                );

                // Draw contained item to visualize whats emitted
                const value = slot.value;
                if (value) {
                    const offset = new Vector(0, -5.5).rotated(effectiveRotation);
                    value.drawItemCenteredClipped(
                        worldPos.x + offset.x,
                        worldPos.y + offset.y,
                        parameters,
                        enumTypeToSize[value.getItemType()]
                    );
                }
            }
        }
    }
}
