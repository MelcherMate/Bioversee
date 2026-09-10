import Foundation
import Supabase

enum ActuatorService {
    static func latestSwitch(deviceId: UUID, name: String) async throws -> Bool {
        struct Row: Decodable { let state: Bool }
        let rows: [Row] = try await SupabaseManager.client
            .from("actuator_switches")
            .select("state")
            .eq("device_id", value: deviceId.uuidString)
            .eq("name", value: name)
            .order("created_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first?.state ?? false
    }

    static func latestSlider(deviceId: UUID, name: String) async throws -> Double {
        struct Row: Decodable { let state: Double }
        let rows: [Row] = try await SupabaseManager.client
            .from("actuator_sliders")
            .select("state")
            .eq("device_id", value: deviceId.uuidString)
            .eq("name", value: name)
            .order("created_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first?.state ?? 0
    }

    static func setSwitch(
        deviceId: UUID,
        name: String,
        state: Bool,
        userId: UUID
    ) async throws {
        try await SupabaseManager.client
            .from("actuator_switches")
            .insert(
                SwitchInsert(
                    deviceId: deviceId,
                    name: name,
                    state: state,
                    userId: userId
                )
            )
            .execute()
    }

    static func setSlider(
        deviceId: UUID,
        name: String,
        state: Double,
        userId: UUID
    ) async throws {
        try await SupabaseManager.client
            .from("actuator_sliders")
            .insert(
                SliderInsert(
                    deviceId: deviceId,
                    name: name,
                    state: state,
                    userId: userId
                )
            )
            .execute()
    }
}

private struct SwitchInsert: Encodable {
    let deviceId: UUID
    let name: String
    let state: Bool
    let userId: UUID

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case name
        case state
        case userId = "user_id"
    }
}

private struct SliderInsert: Encodable {
    let deviceId: UUID
    let name: String
    let state: Double
    let userId: UUID

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case name
        case state
        case userId = "user_id"
    }
}
