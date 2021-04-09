import { Component } from "../component";

export class ExplosiveComponent extends Component {
    static getId() {
        return "Explosive";
    }

    constructor() {
        super();

        this.explode = false;
        this.lifeSpan = 0;
    }
}
