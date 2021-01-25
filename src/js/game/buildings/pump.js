import { enumDirection, Vector } from "../../core/vector";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { T } from "../../translations";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { PumpComponent } from "../components/pump";
import { FluidComponent } from "../components/fluid";
import { enumItemProcessorTypes } from "../components/item_processor";
import { enumPinSlotType, FluidPinsComponent } from "../components/fluid_pins";

export class MetaPumpBuilding extends MetaBuilding {
    constructor() {
        super("pump");
    }

    getSilhouetteColor() {
        return "#000000"; //"#b37dcd";
    }

    isPlaceableToFluids() {
        return true;
    }

    isPlaceableToGround() {
        return false;
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {number}
     */
    getPumpSpeed(root, variant) {
        return 5; //globalConfig.pumpSpeedLPerSecond * HubGoals.upgradeImprovements.fluids;
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(new PumpComponent());
        entity.addComponent(new FluidComponent());
        entity.addComponent(
            new FluidPinsComponent({
                slots: [
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                        type: enumPinSlotType.fluidEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.right,
                        type: enumPinSlotType.fluidEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.bottom,
                        type: enumPinSlotType.fluidEjector,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.left,
                        type: enumPinSlotType.fluidEjector,
                    },
                ],
            })
        );
    }
}
