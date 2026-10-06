import Foundation
import Supabase

enum DeviceService {
    static func listAccessibleDevices() async throws -> [AccessibleDevice] {
        let user = try await SupabaseManager.client.auth.session.user

        let memberships: [DeviceMemberRow] = try await SupabaseManager.client
            .from("device_members")
            .select("device_id, role")
            .eq("user_id", value: user.id.uuidString)
            .execute()
            .value

        let ids = Array(Set(memberships.map(\.deviceId)))
        guard !ids.isEmpty else { return [] }

        let roleByDevice = Dictionary(
            uniqueKeysWithValues: memberships.map { ($0.deviceId, $0.role) }
        )

        let devices: [DeviceRow] = try await SupabaseManager.client
            .from("devices")
            .select("id, owner_id, type, name, created_at, updated_at, config")
            .in("id", values: ids.map(\.uuidString))
            .order("name", ascending: true)
            .execute()
            .value

        let typeOrder = Dictionary(
            uniqueKeysWithValues: DeviceType.allCases.enumerated().map { ($0.element, $0.offset) }
        )

        return devices
            .map { device in
                AccessibleDevice(
                    id: device.id,
                    ownerId: device.ownerId,
                    type: device.type,
                    name: device.name,
                    createdAt: device.createdAt,
                    updatedAt: device.updatedAt,
                    role: roleByDevice[device.id] ?? "viewer",
                    isOwner: device.ownerId == user.id,
                    tankCapacityLiters: BioreactorVolume.capacityLiters(from: device.config)
                )
            }
            .sorted { lhs, rhs in
                if lhs.isOwner != rhs.isOwner { return lhs.isOwner && !rhs.isOwner }
                let typeDiff =
                    (typeOrder[lhs.type] ?? 99) - (typeOrder[rhs.type] ?? 99)
                if typeDiff != 0 { return typeDiff < 0 }
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
    }

    static func createDevice(type: DeviceType, name: String) async throws -> UUID {
        let raw: String = try await SupabaseManager.client.rpc(
            "create_my_device",
            params: CreateDeviceParams(
                pType: type.rawValue,
                pName: name,
                pMemberEmails: [],
                pMemberRole: "viewer"
            )
        ).execute().value

        guard let id = UUID(uuidString: raw) else {
            throw NSError(
                domain: "Bioversee",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to create device"]
            )
        }
        return id
    }

    static func deleteDevice(id: UUID) async throws {
        try await SupabaseManager.client
            .rpc("delete_my_device", params: DeviceIdParams(pDeviceId: id))
            .execute()
    }

    static func leaveDevice(id: UUID) async throws {
        try await SupabaseManager.client
            .rpc("leave_device", params: DeviceIdParams(pDeviceId: id))
            .execute()
    }

    /// Owner deletes the device; members leave it.
    static func removeFromAccount(_ device: AccessibleDevice) async throws {
        if device.isOwner {
            try await deleteDevice(id: device.id)
        } else {
            try await leaveDevice(id: device.id)
        }
    }
}

private struct CreateDeviceParams: Encodable {
    let pType: String
    let pName: String
    let pMemberEmails: [String]
    let pMemberRole: String

    enum CodingKeys: String, CodingKey {
        case pType = "p_type"
        case pName = "p_name"
        case pMemberEmails = "p_member_emails"
        case pMemberRole = "p_member_role"
    }
}

private struct DeviceIdParams: Encodable {
    let pDeviceId: UUID
    enum CodingKeys: String, CodingKey { case pDeviceId = "p_device_id" }
}
