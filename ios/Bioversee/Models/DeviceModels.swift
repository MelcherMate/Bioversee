import Foundation

enum DeviceType: String, Codable, CaseIterable, Identifiable, Hashable {
    case bioreactor
    case pressureVessel = "pressure_vessel"
    case membraneBioreactor = "membrane_bioreactor"
    case waterPurifier = "water_purifier"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .bioreactor: return "Bioreactor"
        case .pressureVessel: return "Pressure Vessel"
        case .membraneBioreactor: return "Membrane MBR"
        case .waterPurifier: return "Water Purifier"
        }
    }
}

struct AccessibleDevice: Identifiable, Hashable, Codable {
    let id: UUID
    let ownerId: UUID
    let type: DeviceType
    let name: String
    let createdAt: String
    let updatedAt: String
    let role: String
    let isOwner: Bool
    /// Working volume in liters (from device config); defaults to 1000 L.
    let tankCapacityLiters: Double

    var canOperate: Bool {
        role == "owner" || role == "admin" || role == "operator"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case type
        case name
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case role
        case isOwner
        case tankCapacityLiters
    }

    init(
        id: UUID,
        ownerId: UUID,
        type: DeviceType,
        name: String,
        createdAt: String,
        updatedAt: String,
        role: String,
        isOwner: Bool,
        tankCapacityLiters: Double = BioreactorVolume.defaultCapacityLiters
    ) {
        self.id = id
        self.ownerId = ownerId
        self.type = type
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.role = role
        self.isOwner = isOwner
        self.tankCapacityLiters = tankCapacityLiters
    }
}

struct DeviceRow: Decodable {
    let id: UUID
    let ownerId: UUID
    let type: DeviceType
    let name: String
    let createdAt: String
    let updatedAt: String
    let config: JSONValue?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case type
        case name
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case config
    }
}

struct DeviceMemberRow: Decodable {
    let deviceId: UUID
    let role: String

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case role
    }
}

// MARK: - Device config (volume)

enum BioreactorVolume {
    static let defaultCapacityLiters: Double = 1000

    /// Matches web `tankCapacityLiters` / `litersFromM3`.
    static func capacityLiters(from config: JSONValue?) -> Double {
        guard let volumeM3 = volumeM3(from: config), volumeM3 > 0 else {
            return defaultCapacityLiters
        }
        return volumeM3 * 1000
    }

    private static func volumeM3(from config: JSONValue?) -> Double? {
        guard let root = config?.objectValue else { return nil }
        let nested = root["bioreactor"]?.objectValue ?? root
        guard let value = nested["volume_m3"]?.numberValue, value.isFinite, value > 0 else {
            return nil
        }
        return value
    }
}

/// Minimal JSON tree for decoding `devices.config` jsonb.
enum JSONValue: Decodable, Hashable {
    case object([String: JSONValue])
    case array([JSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            self = .null
        }
    }

    var objectValue: [String: JSONValue]? {
        if case let .object(value) = self { return value }
        return nil
    }

    var numberValue: Double? {
        if case let .number(value) = self { return value }
        return nil
    }
}
