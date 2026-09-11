import Foundation

struct AppNotification: Identifiable, Hashable {
    let id: UUID
    let kind: String
    let title: String
    let body: String?
    let data: [String: AnyCodableJSON]
    let readAt: String?
    let createdAt: String
    let inviteStatus: String?

    var inviteId: UUID? {
        guard let raw = data["invite_id"]?.stringValue?
            .trimmingCharacters(in: .whitespacesAndNewlines),
            !raw.isEmpty
        else { return nil }
        return UUID(uuidString: raw)
    }

    var isPendingInvite: Bool {
        guard kind == "device_invite" else { return false }
        if inviteStatus == "pending" { return true }
        // Fallback when join miss / status null but invite not resolved yet.
        if inviteStatus == nil, data["resolved"] == nil, inviteId != nil {
            return true
        }
        return false
    }

    var isUnread: Bool {
        if isPendingInvite { return true }
        return readAt == nil
    }
}

struct AcceptInviteResult: Decodable {
    let deviceId: UUID
    let type: DeviceType
    let name: String
    let role: String

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case type
        case name
        case role
    }
}

/// Lightweight JSON wrapper for notification payload maps.
enum AnyCodableJSON: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: AnyCodableJSON])
    case array([AnyCodableJSON])
    case null

    var stringValue: String? {
        switch self {
        case .string(let value): return value
        case .number(let value): return String(value)
        case .bool(let value): return value ? "true" : "false"
        default: return nil
        }
    }

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
        } else if let value = try? container.decode([String: AnyCodableJSON].self) {
            self = .object(value)
        } else if let value = try? container.decode([AnyCodableJSON].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}
