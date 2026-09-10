import Foundation
import Supabase

enum NotificationService {
    static func list(limit: Int = 40) async throws -> [AppNotification] {
        let rows: [NotificationRPCRow] = try await SupabaseManager.client
            .rpc("list_my_notifications", params: NotificationLimitParams(pLimit: limit))
            .execute()
            .value

        return rows.map {
            AppNotification(
                id: $0.id,
                kind: $0.kind,
                title: $0.title,
                body: $0.body,
                data: $0.data ?? [:],
                readAt: $0.readAt,
                createdAt: $0.createdAt,
                inviteStatus: $0.inviteStatus
            )
        }
    }

    static func acceptInvite(inviteId: UUID) async throws -> AcceptInviteResult {
        try await SupabaseManager.client
            .rpc("accept_device_invite", params: InviteIdParams(pInviteId: inviteId))
            .execute()
            .value
    }

    static func declineInvite(inviteId: UUID) async throws {
        try await SupabaseManager.client
            .rpc("decline_device_invite", params: InviteIdParams(pInviteId: inviteId))
            .execute()
    }

    static func markRead(notificationId: UUID) async throws {
        try await SupabaseManager.client
            .rpc(
                "mark_notification_read",
                params: NotificationIdParams(pNotificationId: notificationId)
            )
            .execute()
    }

    static func unreadCount(_ items: [AppNotification]) -> Int {
        items.filter(\.isUnread).count
    }
}

private struct NotificationLimitParams: Encodable {
    let pLimit: Int
    enum CodingKeys: String, CodingKey { case pLimit = "p_limit" }
}

private struct InviteIdParams: Encodable {
    let pInviteId: UUID
    enum CodingKeys: String, CodingKey { case pInviteId = "p_invite_id" }
}

private struct NotificationIdParams: Encodable {
    let pNotificationId: UUID
    enum CodingKeys: String, CodingKey { case pNotificationId = "p_notification_id" }
}

private struct NotificationRPCRow: Decodable {
    let id: UUID
    let kind: String
    let title: String
    let body: String?
    let data: [String: AnyCodableJSON]?
    let readAt: String?
    let createdAt: String
    let inviteStatus: String?

    enum CodingKeys: String, CodingKey {
        case id, kind, title, body, data
        case readAt = "read_at"
        case createdAt = "created_at"
        case inviteStatus = "invite_status"
    }
}
