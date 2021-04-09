import { Vector } from "../../core/vector";
import { Component } from "../component";
import { Entity } from "../entity";

export class ObserverComponent extends Component {
    static getId() {
        return "Observer";
    }

    constructor() {
        super();

        /** @type {Entity} */
        this.lastSeen = null;

        /** @type {Vector} */
        this.lastPos = null;
    }
}
