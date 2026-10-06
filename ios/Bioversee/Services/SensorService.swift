import Foundation
import Supabase

struct SensorReading: Identifiable, Hashable {
    var id: String { "\(createdAt)-\(value)" }
    let value: Double
    let createdAt: Date
}

enum SensorService {
    static func readings(deviceId: UUID, name: String) async throws -> [SensorReading] {
        struct Row: Decodable {
            let value: Double
            let createdAt: String

            enum CodingKeys: String, CodingKey {
                case value
                case createdAt = "created_at"
            }
        }

        let rows: [Row] = try await SupabaseManager.client
            .from("sensors")
            .select("name, value, created_at")
            .eq("device_id", value: deviceId.uuidString)
            .eq("name", value: name)
            .order("created_at", ascending: true)
            .execute()
            .value

        return rows.compactMap { row in
            guard let date = Self.parseDate(row.createdAt) else { return nil }
            return SensorReading(value: row.value, createdAt: date)
        }
    }

    /// Persist a single sensor sample (matches web `insertSensorReading`).
    static func insertReading(
        deviceId: UUID,
        name: String,
        value: Double,
        userId: UUID
    ) async throws {
        try await SupabaseManager.client
            .from("sensors")
            .insert(
                SensorInsert(
                    deviceId: deviceId,
                    name: name,
                    value: value,
                    userId: userId
                )
            )
            .execute()
    }

    /// Last 6 points, matching the web Chart slice.
    static func chartPoints(from readings: [SensorReading]) -> [SensorReading] {
        Array(readings.suffix(6))
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static func parseDate(_ raw: String) -> Date? {
        isoFractional.date(from: raw) ?? iso.date(from: raw)
    }
}

private struct SensorInsert: Encodable {
    let deviceId: UUID
    let name: String
    let value: Double
    let userId: UUID

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case name
        case value
        case userId = "user_id"
    }
}
