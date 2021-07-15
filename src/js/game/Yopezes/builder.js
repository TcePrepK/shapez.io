import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Vector } from "../../core/vector";
import { Entity } from "../entity";
import { GameRoot } from "../root";
import { ShapeDefinition } from "../shape_definition";
import { Yopez } from "./yopez";

export class BuilderYopez extends Yopez {
    /**
     * @param {GameRoot} root
     * @param {number} x
     * @param {number} y
     * @param {number} mag
     * @param {ShapeDefinition} definition
     */
    constructor(root, x, y, mag, definition) {
        super(root, x, y, definition);

        /**
         * This position in needed because if we are not tracing anything,
         * we need yopez to go back to its starting pos (aka builder)
         */
        this.startingPos = this.copy();

        /**
         * Yopez will try to trace this entity
         * @type {Entity}
         */
        this.tracing;

        /**
         * Yopezes will try to trace this position
         * @type {Vector}
         */
        this.tracingPos;

        this.vel = new Vector();
        this.acc = new Vector();

        this.mag = mag;
    }

    update() {
        // Stop tracing if it is destroyed
        if (
            this.tracing &&
            (this.tracing.queuedForDestroy || !this.tracing.components.StaticMapEntity.isBlueprint)
        )
            this.resetTracing();

        const tracing = this.tracing ? this.tracingPos : this.startingPos;
        const path = tracing.sub(this);
        const length = path.length();
        const limit = this.tracing ? 2.5 : 2;

        if (!this.tracing && length < 10) {
            if (length < 1) {
                this.x = this.startingPos.x;
                this.y = this.startingPos.y;
                return;
            }
            this.addInplace(path.divideScalar(length));
            return;
        }

        const norm = path.normalize();
        this.acc = norm.multiplyScalar(this.mag);

        this.vel.addInplace(this.acc);
        this.vel = this.vel.limit(limit);

        this.addInplace(this.vel);

        // We don't build if we are not close enough
        if (!this.isWorking) return;

        // Building Part
        const staticComp = this.tracing.components.StaticMapEntity;
        if (!staticComp.isBlueprint) return;

        const tickRate = this.root.dynamicTickrate.currentTickRate;
        staticComp.buildingProgress += 1 / tickRate;

        if (staticComp.isBlueprint) return;

        this.root.signals.entityAdded.dispatch(this.tracing);
        this.resetTracing();
    }

    get isWorking() {
        if (!this.tracing) return false;
        const staticComp = this.tracing.components.StaticMapEntity;
        assert(staticComp.isBlueprint, "Trying to build not blueprint building!");

        const tileSize = globalConfig.tileSize;
        const rect = staticComp.getTileSpaceBounds().allScaled(tileSize);
        return rect.containsPoint(this.x, this.y);
    }

    /**
     * Tries to trace entity
     * @param {Entity} blueprint
     */
    tryTracing(blueprint) {
        if (this.tracing) return false;

        const staticComp = blueprint.components.StaticMapEntity;
        const center = staticComp.getTileSpaceBounds().getCenter().toWorldSpace();
        this.tracing = blueprint;
        this.tracingPos = center.copy();

        return true;
    }

    /**
     * Resets traced entity
     */
    resetTracing() {
        this.tracing = null;
        this.tracingPos = null;
    }

    /**
     * @param {DrawParameters} parameters
     */
    draw(parameters) {
        const tracing = this.tracingPos ? this.tracingPos : this.startingPos;
        const path = tracing.sub(this);

        const angle = !this.equals(tracing) ? path.multiplyScalar(-1).angle() : 0;

        const ctx = parameters.context;
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        this.definition.drawCentered(0, 0, parameters);
        ctx.rotate(-angle);
        ctx.translate(-this.x, -this.y);
    }
}
