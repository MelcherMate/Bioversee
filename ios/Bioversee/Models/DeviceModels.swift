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
    }
}

struct DeviceRow: Decodable {
    let id: UUID
    let ownerId: UUID
    let type: DeviceType
    let name: String
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case type
        case name
        case createdAt = "created_at"
        case updatedAt = "updated_at"
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
