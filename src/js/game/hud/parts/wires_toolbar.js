import { HUDBaseToolbar } from "./base_toolbar";
import { MetaWireBuilding } from "../../buildings/wire";
import { MetaConstantSignalBuilding } from "../../buildings/constant_signal";
import { MetaLogicGateBuilding } from "../../buildings/logic_gate";
import { MetaLeverBuilding } from "../../buildings/lever";
import { MetaWireTunnelBuilding } from "../../buildings/wire_tunnel";
import { MetaVirtualProcessorBuilding } from "../../buildings/virtual_processor";
import { MetaTransistorBuilding } from "../../buildings/transistor";
import { MetaAnalyzerBuilding } from "../../buildings/analyzer";
import { MetaComparatorBuilding } from "../../buildings/comparator";
import { MetaReaderBuilding } from "../../buildings/reader";
import { MetaFilterBuilding } from "../../buildings/filter";
import { MetaDisplayBuilding } from "../../buildings/display";
import { MetaWirelessBuildingsBuilding } from "../../buildings/wireless_buildings";
import { MetaStorageBuilding } from "../../buildings/storage";
import { MetaSignalTransportBuilding } from "../../buildings/signal_transport";
import { MetaToolbarChangerBuilding } from "../../buildings/toolbar_changer";

export class HUDWiresToolbar extends HUDBaseToolbar {
    constructor(root) {
        const wirelessBuildingsMod = root.app.settings.getAllSettings().wirelessBuildingsMod;
        const mathGatesMod = root.app.settings.getAllSettings().mathGatesMod;
        super(root, {
            primaryBuildings: [
                ...(mathGatesMod ? [MetaToolbarChangerBuilding] : []),
                MetaWireBuilding,
                MetaWireTunnelBuilding,
                MetaConstantSignalBuilding,
                MetaLogicGateBuilding,
                MetaVirtualProcessorBuilding,
                MetaAnalyzerBuilding,
                MetaComparatorBuilding,
                MetaTransistorBuilding,
            ],
            secondaryBuildings: [
                MetaStorageBuilding,
                MetaReaderBuilding,
                MetaLeverBuilding,
                MetaFilterBuilding,
                MetaDisplayBuilding,
                ...(wirelessBuildingsMod ? [MetaWirelessBuildingsBuilding] : []),
                ...(wirelessBuildingsMod ? [MetaSignalTransportBuilding] : []),
            ],
            visibilityCondition: () =>
                !this.root.camera.getIsMapOverlayActive() &&
                this.root.currentLayer === "wires" &&
                !this.root.nextToolbar,
            htmlElementId: "ingame_HUD_wires_toolbar",
            layer: "wires",
            nextToolbar: true,
        });
    }
}
