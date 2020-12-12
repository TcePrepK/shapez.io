import { enumDirection, Vector } from "../../core/vector";
import { ItemAcceptorComponent } from "../components/item_acceptor";
import { ItemEjectorComponent } from "../components/item_ejector";
import { enumItemProcessorTypes, ItemProcessorComponent } from "../components/item_processor";
import { Entity } from "../entity";
import { MetaBuilding, defaultBuildingVariant } from "../meta_building";
import { GameRoot } from "../root";
import { enumHubGoalRewards } from "../tutorial_goals";
import { T } from "../../translations";
import { formatItemsPerSecond, generateMatrixRotations } from "../../core/utils";
import { BeltUnderlaysComponent } from "../components/belt_underlays";
import { ProgrammableBalancerComponent } from "../components/programmable_balancer";
import { AutoBalancerComponent } from "../components/auto_balancer";
import { BeltSwapperComponent } from "../components/belt_swapper";

/** @enum {string} */
export const enumBalancerVariants = {
    merger: "merger",
    mergerInverse: "merger-inverse",
    splitter: "splitter",
    splitterInverse: "splitter-inverse",
    programmableBalancer: "programmable-balancer",
    autoBalancer: "auto-balancer",
    beltSwapper: "belt-swapper",
};

const overlayMatrices = {
    [defaultBuildingVariant]: null,
    [enumBalancerVariants.merger]: generateMatrixRotations([0, 1, 0, 0, 1, 1, 0, 1, 0]),
    [enumBalancerVariants.mergerInverse]: generateMatrixRotations([0, 1, 0, 1, 1, 0, 0, 1, 0]),
    [enumBalancerVariants.splitter]: generateMatrixRotations([0, 1, 0, 0, 1, 1, 0, 1, 0]),
    [enumBalancerVariants.splitterInverse]: generateMatrixRotations([0, 1, 0, 1, 1, 0, 0, 1, 0]),
    [enumBalancerVariants.programmableBalancer]: null,
    [enumBalancerVariants.autoBalancer]: null,
    [enumBalancerVariants.beltSwapper]: null,
};

export class MetaBalancerBuilding extends MetaBuilding {
    constructor() {
        super("balancer");
    }

    getDimensions(variant) {
        switch (variant) {
            case defaultBuildingVariant:
            case enumBalancerVariants.beltSwapper:
                return new Vector(2, 1);
            case enumBalancerVariants.merger:
            case enumBalancerVariants.mergerInverse:
            case enumBalancerVariants.splitter:
            case enumBalancerVariants.splitterInverse:
            case enumBalancerVariants.programmableBalancer:
            case enumBalancerVariants.autoBalancer:
                return new Vector(1, 1);
            default:
                assertAlways(false, "Unknown balancer variant: " + variant);
        }
    }

    getIsRotateable(variant) {
        if (variant == enumBalancerVariants.programmableBalancer) {
            return false;
        }
        return true;
    }

    /**
     * @param {number} rotation
     * @param {number} rotationVariant
     * @param {string} variant
     * @param {Entity} entity
     * @returns {Array<number>|null}
     */
    getSpecialOverlayRenderMatrix(rotation, rotationVariant, variant, entity) {
        const matrix = overlayMatrices[variant];
        if (matrix) {
            return matrix[rotation];
        }
        return null;
    }

    /**
     * @param {GameRoot} root
     * @param {string} variant
     * @returns {Array<[string, string]>}
     */
    getAdditionalStatistics(root, variant) {
        let speedMultiplier = 2;
        switch (variant) {
            case enumBalancerVariants.merger:
            case enumBalancerVariants.mergerInverse:
            case enumBalancerVariants.splitter:
            case enumBalancerVariants.splitterInverse:
            case enumBalancerVariants.programmableBalancer:
            case enumBalancerVariants.autoBalancer:
                speedMultiplier = 1;
        }

        const speed =
            (root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.balancer) / 2) * speedMultiplier;
        return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
    }

    getSilhouetteColor() {
        return "#555759";
    }

    /**
     * @param {GameRoot} root
     */
    getAvailableVariants(root) {
        // @ts-ignore
        this.moreBalancerMod = root.app.settings.getAllSettings().moreBalancerMod;

        let available = [defaultBuildingVariant];

        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_merger)) {
            available.push(enumBalancerVariants.merger, enumBalancerVariants.mergerInverse);
        }

        if (root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_splitter)) {
            available.push(enumBalancerVariants.splitter, enumBalancerVariants.splitterInverse);
        }

        if (this.moreBalancerMod && root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_merger)) {
            available.push(
                enumBalancerVariants.programmableBalancer,
                enumBalancerVariants.autoBalancer,
                enumBalancerVariants.beltSwapper
            );
        }

        return available;
    }

    /**
     * @param {GameRoot} root
     */
    getIsUnlocked(root) {
        return root.hubGoals.isRewardUnlocked(enumHubGoalRewards.reward_balancer);
    }

    /**
     * Creates the entity at the given location
     * @param {Entity} entity
     */
    setupEntityComponents(entity) {
        entity.addComponent(
            new ItemAcceptorComponent({
                slots: [], // set later
            })
        );

        entity.addComponent(
            new ItemProcessorComponent({
                inputsPerCharge: 1,
                processorType: enumItemProcessorTypes.balancer,
            })
        );

        entity.addComponent(
            new ItemEjectorComponent({
                slots: [], // set later
                renderFloatingItems: false,
            })
        );

        entity.addComponent(new BeltUnderlaysComponent({ underlays: [] }));
    }

    /**
     *
     * @param {Entity} entity
     * @param {number} rotationVariant
     * @param {string} variant
     */
    updateVariants(entity, rotationVariant, variant) {
        switch (variant) {
            case defaultBuildingVariant: {
                entity.components.ItemAcceptor.setSlots([
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                    },
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.bottom],
                    },
                ]);

                entity.components.ItemEjector.setSlots([
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                ]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                ];

                break;
            }
            case enumBalancerVariants.merger:
            case enumBalancerVariants.mergerInverse: {
                entity.components.ItemAcceptor.setSlots([
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                    },
                    {
                        pos: new Vector(0, 0),
                        directions: [
                            variant === enumBalancerVariants.mergerInverse
                                ? enumDirection.left
                                : enumDirection.right,
                        ],
                    },
                ]);

                entity.components.ItemEjector.setSlots([
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                ]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                ];

                break;
            }
            case enumBalancerVariants.splitter:
            case enumBalancerVariants.splitterInverse: {
                entity.components.ItemAcceptor.setSlots([
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                    },
                ]);

                entity.components.ItemEjector.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                    },
                    {
                        pos: new Vector(0, 0),
                        direction:
                            variant === enumBalancerVariants.splitterInverse
                                ? enumDirection.left
                                : enumDirection.right,
                    },
                ]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                ];

                break;
            }
            case enumBalancerVariants.programmableBalancer: {
                entity.components.ItemEjector.setSlots([]);

                if (
                    !entity.components.ProgrammableBalancer &&
                    variant == enumBalancerVariants.programmableBalancer
                ) {
                    entity.addComponent(new ProgrammableBalancerComponent());
                } else if (!entity.components.AutoBalancer && variant == enumBalancerVariants.autoBalancer) {
                    entity.addComponent(new AutoBalancerComponent());
                }

                entity.components.ItemAcceptor.setSlots([
                    {
                        pos: new Vector(0, 0),
                        directions: [
                            enumDirection.top,
                            enumDirection.right,
                            enumDirection.bottom,
                            enumDirection.left,
                        ],
                    },
                ]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(0, 0), direction: enumDirection.right },
                    { pos: new Vector(0, 0), direction: enumDirection.bottom },
                    { pos: new Vector(0, 0), direction: enumDirection.left },
                ];

                break;
            }
            case enumBalancerVariants.autoBalancer: {
                entity.components.ItemEjector.setSlots([]);

                if (!entity.components.AutoBalancer && variant == enumBalancerVariants.autoBalancer) {
                    entity.addComponent(new AutoBalancerComponent());
                }

                entity.components.ItemAcceptor.setSlots([]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(0, 0), direction: enumDirection.right },
                    { pos: new Vector(0, 0), direction: enumDirection.bottom },
                    { pos: new Vector(0, 0), direction: enumDirection.left },
                ];

                break;
            }
            case enumBalancerVariants.beltSwapper: {
                if (!entity.components.BeltSwapper && variant == enumBalancerVariants.beltSwapper) {
                    entity.addComponent(new BeltSwapperComponent());
                }

                entity.components.ItemAcceptor.setSlots([
                    {
                        pos: new Vector(0, 0),
                        directions: [enumDirection.bottom],
                    },
                    {
                        pos: new Vector(1, 0),
                        directions: [enumDirection.bottom],
                    },
                ]);

                entity.components.ItemEjector.setSlots([
                    {
                        pos: new Vector(0, 0),
                        direction: enumDirection.top,
                    },
                    {
                        pos: new Vector(1, 0),
                        direction: enumDirection.top,
                    },
                ]);

                entity.components.BeltUnderlays.underlays = [
                    { pos: new Vector(0, 0), direction: enumDirection.top },
                    { pos: new Vector(0, 0), direction: enumDirection.bottom },
                    { pos: new Vector(1, 0), direction: enumDirection.top },
                    { pos: new Vector(1, 0), direction: enumDirection.bottom },
                ];

                break;
            }
            default:
                assertAlways(false, "Unknown balancer variant: " + variant);
        }
    }
}
