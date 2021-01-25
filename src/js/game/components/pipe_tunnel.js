import { Component } from "../component";

export class PipeTunnelComponent extends Component {
    static getId() {
        return "PipeTunnel";
    }

    constructor() {
        super();

        /**
         * Linked network, only if its not multiple directions
         * @type {Array<import("../systems/pipe").PipeNetwork>}
         */
        this.linkedNetworks = [];
    }
}
