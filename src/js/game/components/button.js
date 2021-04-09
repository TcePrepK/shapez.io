import { Component } from "../component";
import { types } from "../../savegame/serialization";

export class ButtonComponent extends Component {
    static getId() {
        return "Button";
    }

    /**
     * Copy the current state to another component
     * @param {ButtonComponent} otherComponent
     */
    copyAdditionalStateTo(otherComponent) {
        otherComponent.toggled = this.toggled;
    }

    /**
     * @param {object} param0
     * @param {boolean=} param0.toggled
     */
    constructor({ toggled = false }) {
        super();
        this.toggled = toggled;

        const desiredFPS = this.root.app.settings.getDesiredFps();
        const oneAndHalfSecond = desiredFPS * 1.5;
        this.maxSpan = oneAndHalfSecond; // Minecraft button lives only 1.5 second :P
        this.lifeSpan = 0;
    }
}
