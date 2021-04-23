import { Component } from "../component";
import { TrashItem } from "../items/trash_item";

export class TrashComponent extends Component {
    static getId() {
        return "Trash";
    }

    constructor() {
        super();

        /** @type {Array<TrashItem>} */
        this.trashList = [];
    }
}
