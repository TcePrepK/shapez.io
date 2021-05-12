import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Rectangle } from "../../core/rectangle";
import { AtlasSprite } from "../../core/sprites";
import { enumDirection, Vector } from "../../core/vector";
import { types } from "../../savegame/serialization";
import { getBuildingDataFromCode } from "../building_codes";
import { Component } from "../component";

export class StaticMapEntityComponent extends Component {
    static getId() {
        return "StaticMapEntity";
    }

    static getSchema() {
        return {
            origin: types.tileVector,
            rotation: types.float,
            originalRotation: types.float,

            // See building_codes.js
            code: types.uint,
        };
    }

    /**
     * Effective hit boxes
     * @returns {Array<Rectangle>}
     */
    get hitBoxes() {
        return getBuildingDataFromCode(this.code).hitBoxes;
    }

    /**
     * Main rectangle
     * @returns {Rectangle}
     */
    getMainHitBox() {
        if (this.hitBoxes.length === 1) {
            return this.hitBoxes[0];
        }

        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;
        for (const rect of this.hitBoxes) {
            if (rect.top() < top) {
                top = rect.top();
            }
            if (rect.right() > right) {
                right = rect.right();
            }
            if (rect.bottom() > bottom) {
                bottom = rect.bottom();
            }
            if (rect.left() < left) {
                left = rect.left();
            }
        }
        return Rectangle.fromTRBL(top, right, bottom, left);
    }

    /**
     * Returns if hitbox contains given point
     * @param {Number} x
     * @param {Number} y
     */
    containsPoint(x, y) {
        for (const rect of this.hitBoxes) {
            if (!rect.containsPoint(x, y)) {
                continue;
            }

            return true;
        }

        return false;
    }

    /**
     * Returns the sprite
     * @returns {AtlasSprite}
     */
    getSprite() {
        return getBuildingDataFromCode(this.code).sprite;
    }

    /**
     * Returns the blueprint sprite
     * @returns {AtlasSprite}
     */
    getBlueprintSprite() {
        return getBuildingDataFromCode(this.code).blueprintSprite;
    }

    /**
     * Returns the silhouette color
     * @returns {string}
     */
    getSilhouetteColor() {
        return getBuildingDataFromCode(this.code).silhouetteColor;
    }

    /**
     * Returns the meta building
     * @returns {import("../meta_building").MetaBuilding}
     */
    getMetaBuilding() {
        return getBuildingDataFromCode(this.code).metaInstance;
    }

    /**
     * Returns the buildings variant
     * @returns {string}
     */
    getVariant() {
        return getBuildingDataFromCode(this.code).variant;
    }

    /**
     * Copy the current state to another component
     * @param {Component} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        return new StaticMapEntityComponent({
            origin: this.origin.copy(),
            rotation: this.rotation,
            originalRotation: this.originalRotation,
            code: this.code,
        });
    }

    /**
     *
     * @param {object} param0
     * @param {Vector=} param0.origin Origin (Top Left corner) of the entity
     * @param {Vector=} param0.tileSize Size of the entity in tiles
     * @param {number=} param0.rotation Rotation in degrees. Must be multiple of 90
     * @param {number=} param0.originalRotation Original Rotation in degrees. Must be multiple of 90
     * @param {number=} param0.code Building code
     */
    constructor({ origin = new Vector(), rotation = 0, originalRotation = 0, code = 0 }) {
        super();
        assert(
            rotation % 90 === 0,
            "Rotation of static map entity must be multiple of 90 (was " + rotation + ")"
        );

        this.origin = origin;
        this.rotation = rotation;
        this.code = code;
        this.originalRotation = originalRotation;
    }

    /**
     * Returns the effective rectangle of this entity in tile space
     * @returns {Array<Rectangle>}
     */
    getTileSpaceBounds() {
        /** @type {Array<Rectangle>} */
        const rotatedHitBoxes = [];
        for (const rect of this.hitBoxes) {
            const pos = new Vector(rect.x, rect.y);
            // const rotPos = pos.rotateFastMultipleOf90(this.rotation);
            const width = rect.w;
            const height = rect.h;
            const newPos = pos.rotateFastMultipleOf90(this.rotation);

            switch (this.rotation) {
                case 0: {
                    rotatedHitBoxes.push(
                        new Rectangle(this.origin.x + newPos.x, this.origin.y + newPos.y, width, height)
                    );
                    continue;
                }
                case 180: {
                    rotatedHitBoxes.push(
                        new Rectangle(
                            this.origin.x + newPos.x - width + 1,
                            this.origin.y + newPos.y - height + 1,
                            width,
                            height
                        )
                    );
                    continue;
                }
                case 90: {
                    rotatedHitBoxes.push(
                        new Rectangle(this.origin.x + newPos.x, this.origin.y + newPos.y, height, width)
                    );
                    continue;
                }
                case 270: {
                    rotatedHitBoxes.push(
                        new Rectangle(
                            this.origin.x + newPos.x - height + 1,
                            this.origin.y + newPos.y - width + 1,
                            height,
                            width
                        )
                    );
                    continue;
                }
                default:
                    assert(false, "Invalid rotation");
                    continue;
            }
        }

        return rotatedHitBoxes;
    }

    /**
     * Transforms the given vector/rotation from local space to world space
     * @param {Vector} vector
     * @returns {Vector}
     */
    applyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(this.rotation);
    }

    /**
     * Transforms the given vector/rotation from world space to local space
     * @param {Vector} vector
     * @returns {Vector}
     */
    unapplyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(360 - this.rotation);
    }

    /**
     * Transforms the given direction from local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    localDirectionToWorld(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, this.rotation);
    }

    /**
     * Transforms the given direction from world to local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    worldDirectionToLocal(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, 360 - this.rotation);
    }

    /**
     * Transforms from local tile space to global tile space
     * @param {Vector} localTile
     * @returns {Vector}
     */
    localTileToWorld(localTile) {
        const result = localTile.rotateFastMultipleOf90(this.rotation);
        result.x += this.origin.x;
        result.y += this.origin.y;
        return result;
    }

    /**
     * Transforms from world space to local space
     * @param {Vector} worldTile
     */
    worldToLocalTile(worldTile) {
        const localUnrotated = worldTile.sub(this.origin);
        return this.unapplyRotationToVector(localUnrotated);
    }

    /**
     * Returns whether the entity should be drawn for the given parameters
     * @param {DrawParameters} parameters
     */
    shouldBeDrawn(parameters) {
        const visibleRect = parameters.visibleRect;
        const bounds = this.getTileSpaceBounds();
        for (const bound of bounds) {
            visibleRect.containsRect(bound.allScaled(globalConfig.tileSize));
            return true;
        }

        return false;
    }

    /**
     * Draws a sprite over the whole space of the entity
     * @param {DrawParameters} parameters
     * @param {AtlasSprite} sprite
     * @param {number=} extrudePixels How many pixels to extrude the sprite
     * @param {Vector=} overridePosition Whether to drwa the entity at a different location
     */
    drawSpriteOnBoundsClipped(parameters, sprite, extrudePixels = 0, overridePosition = null) {
        if (!this.shouldBeDrawn(parameters) && !overridePosition) {
            return;
        }
        const size = this.getMainHitBox();
        const hitBoxes = this.hitBoxes;
        let worldX = this.origin.x * globalConfig.tileSize;
        let worldY = this.origin.y * globalConfig.tileSize;

        if (overridePosition) {
            worldX = overridePosition.x * globalConfig.tileSize;
            worldY = overridePosition.y * globalConfig.tileSize;
        }

        if (this.rotation === 0) {
            // Early out, is faster
            sprite.drawCached(
                parameters,
                worldX - extrudePixels * size.w,
                worldY - extrudePixels * size.h,
                globalConfig.tileSize * size.w + 2 * extrudePixels * size.w,
                globalConfig.tileSize * size.h + 2 * extrudePixels * size.h,
                true,
                size,
                hitBoxes
            );
        } else {
            const rotationCenterX = worldX + globalConfig.halfTileSize;
            const rotationCenterY = worldY + globalConfig.halfTileSize;

            parameters.context.translate(rotationCenterX, rotationCenterY);
            parameters.context.rotate(Math.radians(this.rotation));
            sprite.drawCached(
                parameters,
                -globalConfig.halfTileSize - extrudePixels * size.w,
                -globalConfig.halfTileSize - extrudePixels * size.h,
                globalConfig.tileSize * size.w + 2 * extrudePixels * size.w,
                globalConfig.tileSize * size.h + 2 * extrudePixels * size.h,
                false, // no clipping possible here
                size,
                hitBoxes
            );
            parameters.context.rotate(-Math.radians(this.rotation));
            parameters.context.translate(-rotationCenterX, -rotationCenterY);
        }
    }
}
