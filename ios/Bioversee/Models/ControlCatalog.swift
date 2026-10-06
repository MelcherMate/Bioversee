import Foundation

enum ControlKind {
    case switchControl
    case slider
}

struct DeviceControl: Identifiable, Hashable {
    let id: String
    let kind: ControlKind
    let name: String
    let label: String
    let min: Double
    let max: Double
    let unit: String?

    init(
        kind: ControlKind,
        name: String,
        label: String,
        min: Double = 0,
        max: Double = 100,
        unit: String? = nil
    ) {
        self.id = name
        self.kind = kind
        self.name = name
        self.label = label
        self.min = min
        self.max = max
        self.unit = unit
    }
}

enum ControlCatalog {
    static func controls(for type: DeviceType) -> [DeviceControl] {
        switch type {
        case .bioreactor:
            return [
                .init(kind: .switchControl, name: "switchWarmWaterPump", label: "Warm water"),
                .init(kind: .switchControl, name: "switchColdWaterPump", label: "Cold water"),
                .init(kind: .switchControl, name: "switchAcidPump", label: "Acid"),
                .init(kind: .switchControl, name: "switchBasePump", label: "Base"),
                .init(kind: .slider, name: "rotor", label: "Mixer", min: 0, max: 300, unit: "rpm"),
                .init(kind: .slider, name: "aerator", label: "Aerator"),
            ]
        case .pressureVessel:
            return [
                .init(kind: .slider, name: "vesselLevel", label: "Water level"),
            ]
        case .membraneBioreactor:
            return [
                .init(kind: .switchControl, name: "mbrFlow", label: "Circulation"),
                .init(kind: .switchControl, name: "mbrAeration", label: "Diffuser"),
                .init(kind: .slider, name: "mbrAerationLevel", label: "Intensity"),
            ]
        case .waterPurifier:
            return [
                .init(kind: .switchControl, name: "switchPump1", label: "Puffer → Active"),
                .init(kind: .switchControl, name: "switchPump2", label: "Additive → Active"),
                .init(kind: .switchControl, name: "switchPump3", label: "Active → Clean"),
                .init(kind: .slider, name: "agitator", label: "Agitator"),
            ]
        }
    }
}

struct SensorChartSpec: Identifiable, Hashable {
    var id: String { name }
    let name: String
    let label: String
}

enum SensorCatalog {
    /// Matches web Chart usage (bioreactor + water purifier only).
    static func charts(for type: DeviceType) -> [SensorChartSpec] {
        switch type {
        case .bioreactor:
            return [
                .init(name: "temperature", label: "Temperature"),
                .init(name: "ph", label: "pH"),
            ]
        case .waterPurifier:
            return [
                .init(name: "pufferwtlvl", label: "Buffer water level"),
            ]
        case .pressureVessel, .membraneBioreactor:
            return []
        }
    }
}
