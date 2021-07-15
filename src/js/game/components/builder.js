import { Component } from "../component";
import { Entity } from "../entity";
import { GameRoot } from "../root";
import { BuilderYopez } from "../Yopezes/builder";
import { StaticMapEntityComponent } from "./static_map_entity";

export class BuilderComponent extends Component {
    static getId() {
        return "Builder";
    }

    // static getSchema() {
    //     return {
    //         builders: types.array(types.vector),
    //     };
    // }

    constructor() {
        super();

        this.maxBuilders = 1;

        /**
         * Array of builders
         * @type {Array<BuilderYopez>}
         */
        this.builders = [];
    }

    /**
     * Adds new builder
     * @param {GameRoot} root
     * @param {StaticMapEntityComponent} staticComp
     */
    addBuilder(root, staticComp) {
        if (this.builders.length >= this.maxBuilders) return;
        const origin = staticComp.origin.toWorldSpace();
        const tileSize = staticComp.getTileSize().toWorldSpace();
        const center = origin.addScalars(tileSize.x / 2, tileSize.y / 2);
        const bugprint = root.shapeDefinitionMgr.getShapeFromShortKey("Sb----Sb:CbCbCbCb:--CwCw--");
        this.builders.push(new BuilderYopez(root, center.x, center.y, 0.4, bugprint));
    }

    updateBuilders() {
        for (const builder of this.builders) {
            builder.update();
        }
    }

    /**
     * @param {Entity} blueprint
     * @returns {Boolean}
     */
    tryTracingBlueprint(blueprint) {
        const staticComp = blueprint.components.StaticMapEntity;
        assert(staticComp.isBlueprint, "Tried to trace not blueprint building!");

        for (const builder of this.builders) {
            if (builder.tryTracing(blueprint)) return true;
        }

        return false;
    }
}
