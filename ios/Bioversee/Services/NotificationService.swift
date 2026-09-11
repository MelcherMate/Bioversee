import Foundation
import Supabase

struct InboxItem: Identifiable, Hashable {
    var id: String { "\(accountId.uuidString)-\(notification.id.uuidString)" }
    let accountId: UUID
    let accountEmail: String?
    let accountName: String
    let accountAvatarURL: URL?
    let notification: AppNotification

    var isUnread: Bool { notification.isUnread }
}

enum NotificationService {
    static func list(limit: Int = 40) async throws -> [AppNotification] {
        try await list(using: SupabaseManager.client, limit: limit)
    }

    static func list(
        using client: SupabaseClient,
        limit: Int = 40
    ) async throws -> [AppNotification] {
        let rows: [NotificationRPCRow] = try await client
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

    /// Fetch inbox rows for every vault account (Gmail-style unified inbox).
    static func listForAllAccounts(
        _ accounts: [VaultAccount],
        activeSession: Session?
    ) async -> [InboxItem] {
        var items: [InboxItem] = []
        let client = SupabaseManager.client
        let previous = activeSession

        for account in accounts {
            do {
                try await client.auth.setSession(
                    accessToken: account.accessToken,
                    refreshToken: account.refreshToken
                )
                if let refreshed = try? await client.auth.session {
                    AccountVault.updateTokens(for: account.id, session: refreshed)
                }
                let notes = try await list(using: client, limit: 40)
                for note in notes {
                    items.append(
                        InboxItem(
                            accountId: account.id,
                            accountEmail: account.email,
                            accountName: account.displayName,
                            accountAvatarURL: account.avatarURLValue,
                            notification: note
                        )
                    )
                }
            } catch {
                continue
            }
        }

        if let previous {
            try? await client.auth.setSession(
                accessToken: previous.accessToken,
                refreshToken: previous.refreshToken
            )
        }

        return items.sorted {
            $0.notification.createdAt > $1.notification.createdAt
        }
    }

    static func acceptInvite(inviteId: UUID, asAccount account: VaultAccount) async throws {
        try await withAccount(account) {
            // Don't depend on decoding the jsonb payload — membership write is what matters.
            try await SupabaseManager.client
                .rpc("accept_device_invite", params: InviteIdParams(pInviteId: inviteId))
                .execute()
        }
    }

    static func declineInvite(inviteId: UUID, asAccount account: VaultAccount) async throws {
        try await withAccount(account) {
            try await SupabaseManager.client
                .rpc("decline_device_invite", params: InviteIdParams(pInviteId: inviteId))
                .execute()
        }
    }

    static func markRead(notificationId: UUID, asAccount account: VaultAccount) async throws {
        try await withAccount(account) {
            try await SupabaseManager.client
                .rpc(
                    "mark_notification_read",
                    params: NotificationIdParams(pNotificationId: notificationId)
                )
                .execute()
        }
    }

    static func delete(notificationId: UUID, asAccount account: VaultAccount) async throws {
        try await withAccount(account) {
            try await SupabaseManager.client
                .rpc(
                    "delete_my_notification",
                    params: NotificationIdParams(pNotificationId: notificationId)
                )
                .execute()
        }
    }

    static func unreadCount(_ items: [InboxItem]) -> Int {
        items.filter(\.isUnread).count
    }

    private static func withAccount(
        _ account: VaultAccount,
        _ work: () async throws -> Void
    ) async throws {
        let client = SupabaseManager.client
        let previous = try? await client.auth.session
        try await client.auth.setSession(
            accessToken: account.accessToken,
            refreshToken: account.refreshToken
        )
        do {
            try await work()
        } catch {
            if let previous {
                try? await client.auth.setSession(
                    accessToken: previous.accessToken,
                    refreshToken: previous.refreshToken
                )
            }
            throw error
        }
        if let previous {
            try? await client.auth.setSession(
                accessToken: previous.accessToken,
                refreshToken: previous.refreshToken
            )
        }
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
