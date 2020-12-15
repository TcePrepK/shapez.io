import { HUDBaseToolbar } from "./base_toolbar";
import { MetaToolbarChangerBuilding } from "../../buildings/toolbar_changer";
import { MetaBasicMathGatesBuilding } from "../../buildings/basic_math_gates";
import { MetaWireBuilding } from "../../buildings/wire";
import { MetaWireTunnelBuilding } from "../../buildings/wire_tunnel";
import { MetaConstantSignalBuilding } from "../../buildings/constant_signal";
import { MetaComplexMathGatesBuilding } from "../../buildings/complex_math_gates";
import { MetaBetterVirtualProcessorBuilding } from "../../buildings/better_virtual_processor";

export class HUDMathToolbar extends HUDBaseToolbar {
    constructor(root) {
        super(root, {
            primaryBuildings: [
                MetaToolbarChangerBuilding,
                MetaWireBuilding,
                MetaWireTunnelBuilding,
                MetaConstantSignalBuilding,
                MetaBasicMathGatesBuilding,
                MetaComplexMathGatesBuilding,
                MetaBetterVirtualProcessorBuilding,
            ],
            secondaryBuildings: [],
            visibilityCondition: () =>
                // @ts-ignore
                this.root.app.settings.getAllSettings().mathGatesMod &&
                !this.root.camera.getIsMapOverlayActive() &&
                this.root.currentLayer === "wires" &&
                this.root.nextToolbar,
            htmlElementId: "ingame_HUD_wires_toolbar",
            layer: "wires",
            nextToolbar: true,
        });
    }
}
