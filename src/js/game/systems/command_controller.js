import { globalConfig } from "../../core/config";
import { gMetaBuildingRegistry } from "../../core/global_registries";
import { DialogWithForm } from "../../core/modal_dialog_elements";
import { FormCommandInput } from "../../core/modal_dialog_forms";
import { Vector } from "../../core/vector";
import { T } from "../../translations";
import { CommandControllerComponent } from "../components/command_controller";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { BOOL_TRUE_SINGLETON } from "../items/boolean_item";
import { defaultBuildingVariant } from "../meta_building";

const setTile = function ({
    x = 0,
    y = 0,
    building = "empty",
    variant = defaultBuildingVariant,
    rotation = 0,
    rotationVariant = 0,
    layer = "regular",
}) {
    const root = CommandControllerSystem.root;
    if (building == "empty") {
        const contents = root.map.getTileContent(new Vector(x, y), layer);
        if (contents) {
            root.logic.tryDeleteBuilding(contents);
        }
    } else {
        const contents = root.map.getTileContent(new Vector(x, y), layer);
        if (contents) {
            root.logic.tryDeleteBuilding(contents);
        }
        root.logic.tryPlaceBuilding({
            origin: new Vector(x, y),
            rotation,
            rotationVariant,
            originalRotation: 0,
            building: gMetaBuildingRegistry.findById(building),
            variant,
        });
    }
};

const lineBuilding = function ({
    x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0,
    building = "empty",
    variant = defaultBuildingVariant,
    rotation = 0,
    rotationVariant = 0,
    layer = "regular",
}) {
    let dx = Math.abs(x2 - x1),
        sx = x1 < x2 ? 1 : -1,
        dy = -Math.abs(y2 - y1),
        sy = y1 < y2 ? 1 : -1,
        err = dx + dy;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        setTile({
            x: x1,
            y: y1,
            building,
            variant,
            rotation,
            rotationVariant,
            layer,
        });

        if (x1 == x2 && y1 == y2) {
            break;
        }

        const e2 = 2 * err;

        if (e2 >= dy) {
            err += dy;
            x1 += sx;
        }

        if (e2 <= dx) {
            err += dx;
            y1 += sy;
        }
    }
};

const findEntity = function ({ x = 0, y = 0, layer = "regular" }) {
    const root = CommandControllerSystem.root;
    return root.map.getTileContent(new Vector(x, y), layer);
};

//  lineBuilding(root, {x1: 0, y1: -5, x2: 10, y2: -5, building: 'display'});
export class CommandControllerSystem extends GameSystemWithFilter {
    constructor() {
        super([CommandControllerComponent]);

        this.root.signals.entityManuallyPlaced.add(entity => this.editCommandController(entity));

        this.variables = {};

        CommandControllerSystem.root = this.root;
        // CommandControllerSystem.context = this.context;

        // FUNCTIONS

        this.setTile = setTile;
        this.lineBuilding = lineBuilding;
        this.findEntity = findEntity;
    }

    update() {
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const controllerComp = entity.components.CommandController;
            const command = controllerComp.command;
            const wirePins = entity.components.WiredPins;
            let status = false;
            for (let j = 0; j < wirePins.slots.length; ++j) {
                const slot = wirePins.slots[j];
                const network = slot.linkedNetwork;
                if (network) {
                    const item = network.currentValue;
                    if (item === BOOL_TRUE_SINGLETON) {
                        status = true;
                    }
                }
            }

            if (status) {
                try {
                    this.getFunction(command)(this, globalConfig, Vector, entity);
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(error);
                        continue;
                    }
                }

                this.getFunction(command)(this, globalConfig, Vector, entity);
            }
        }
    }

    /**
     * @param {string} val
     */
    getFunction(val) {
        return new Function(
            "{ root, variables, setTile, lineBuilding, findEntity }, globalConfig, Vector, entity",
            val
        );
    }

    /**
     * Asks the entity to enter a valid signal code
     * @param {Entity} entity
     */
    editCommandController(entity, oldCommand = "") {
        if (!entity.components.CommandController) {
            return;
        }

        // Ok, query, but also save the uid because it could get stale
        const uid = entity.uid;

        const signalValueInput = new FormCommandInput({
            id: "signalValue",
            label: "",
            placeholder: "",
            defaultValue: oldCommand,
        });

        const dialog = new DialogWithForm({
            app: this.root.app,
            title: T.dialogs.editSignal.title,
            desc: T.dialogs.editSignal.descItems,
            formElements: [signalValueInput],
            buttons: ["ok:good"],
            closeButton: false,
        });

        dialog.inputReciever.keydown.removeAll();
        this.root.hud.parts.dialogs.internalShowDialog(dialog);

        // When confirmed, set the signal
        const closeHandler = () => {
            if (!this.root || !this.root.entityMgr) {
                // Game got stopped
                return;
            }

            const entityRef = this.root.entityMgr.findByUid(uid, false);
            if (!entityRef) {
                // outdated
                return;
            }

            const controllerComp = this.root.entityMgr.findByUid(uid, false).components.CommandController;

            controllerComp.command = signalValueInput.getValue();
        };

        dialog.buttonSignals.ok.add(closeHandler);
        dialog.valueChosen.add(closeHandler);
    }
}

CommandControllerSystem.root = {};
