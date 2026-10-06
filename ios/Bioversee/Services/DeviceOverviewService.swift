import Foundation
import Supabase

/// Compact live snapshot for device list cards.
struct DeviceOverview: Equatable {
    var temperature: Double?
    var ph: Double?
    var pressure: Double?
    var warmWaterOn = false
    var coldWaterOn = false
    var acidOn = false
    var baseOn = false
    var rotorRpm: Double = 0
    var aeratorPercent: Double = 0
    var waterLevelPercent: Double?

    var activePumps: [String] {
        var names: [String] = []
        if warmWaterOn { names.append("Warm") }
        if coldWaterOn { names.append("Cold") }
        if acidOn { names.append("Acid") }
        if baseOn { names.append("Base") }
        return names
    }
}

enum DeviceOverviewService {
    static func fetchBioreactorOverview(deviceId: UUID) async throws -> DeviceOverview {
        async let switches = latestSwitchMap(deviceId: deviceId)
        async let sliders = latestSliderMap(deviceId: deviceId)
        async let sensors = latestSensorMap(deviceId: deviceId)

        let switchMap = try await switches
        let sliderMap = try await sliders
        let sensorMap = try await sensors

        return DeviceOverview(
            temperature: sensorMap["temperature"],
            ph: sensorMap["ph"],
            pressure: sensorMap["pressure"],
            warmWaterOn: switchMap["switchWarmWaterPump"] ?? false,
            coldWaterOn: switchMap["switchColdWaterPump"] ?? false,
            acidOn: switchMap["switchAcidPump"] ?? false,
            baseOn: switchMap["switchBasePump"] ?? false,
            rotorRpm: sliderMap["rotor"] ?? 0,
            aeratorPercent: sliderMap["aerator"] ?? 0,
            waterLevelPercent: sliderMap["water_level"]
        )
    }

    static func fetchOverviews(
        for devices: [AccessibleDevice]
    ) async -> [UUID: DeviceOverview] {
        await withTaskGroup(of: (UUID, DeviceOverview?).self) { group in
            for device in devices where device.type == .bioreactor {
                group.addTask {
                    do {
                        let overview = try await fetchBioreactorOverview(deviceId: device.id)
                        return (device.id, overview)
                    } catch {
                        return (device.id, nil)
                    }
                }
            }

            var result: [UUID: DeviceOverview] = [:]
            for await (id, overview) in group {
                if let overview {
                    result[id] = overview
                }
            }
            return result
        }
    }

    private static func latestSwitchMap(deviceId: UUID) async throws -> [String: Bool] {
        struct Row: Decodable {
            let name: String
            let state: Bool
        }
        let rows: [Row] = try await SupabaseManager.client
            .from("actuator_switches")
            .select("name, state")
            .eq("device_id", value: deviceId.uuidString)
            .order("created_at", ascending: false)
            .limit(40)
            .execute()
            .value

        var map: [String: Bool] = [:]
        for row in rows where map[row.name] == nil {
            map[row.name] = row.state
        }
        return map
    }

    private static func latestSliderMap(deviceId: UUID) async throws -> [String: Double] {
        struct Row: Decodable {
            let name: String
            let state: Double
        }
        let rows: [Row] = try await SupabaseManager.client
            .from("actuator_sliders")
            .select("name, state")
            .eq("device_id", value: deviceId.uuidString)
            .order("created_at", ascending: false)
            .limit(40)
            .execute()
            .value

        var map: [String: Double] = [:]
        for row in rows where map[row.name] == nil {
            map[row.name] = row.state
        }
        return map
    }

    private static func latestSensorMap(deviceId: UUID) async throws -> [String: Double] {
        struct Row: Decodable {
            let name: String
            let value: Double
        }
        let rows: [Row] = try await SupabaseManager.client
            .from("sensors")
            .select("name, value")
            .eq("device_id", value: deviceId.uuidString)
            .order("created_at", ascending: false)
            .limit(60)
            .execute()
            .value

        var map: [String: Double] = [:]
        for row in rows where map[row.name] == nil {
            map[row.name] = row.value
        }
        return map
    }
}
