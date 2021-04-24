import { Component } from "../component";
import { TrashBooleanItem } from "../items/trash_boolean";
import { TrashColorItem } from "../items/trash_color";
import { TrashShapeItem } from "../items/trash_shape";

export class TrashComponent extends Component {
    static getId() {
        return "Trash";
    }

    constructor() {
        super();

        /** @type {Array<TrashColorItem|TrashShapeItem|TrashBooleanItem>} */
        this.trashList = [];

        /** @type {Array<TrashColorItem|TrashShapeItem|TrashBooleanItem>} */
        this.fallingList = [];
    }
}
