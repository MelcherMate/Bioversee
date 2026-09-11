import Foundation
import Realtime
import Supabase
import UserNotifications

/// Shared inbox across all signed-in accounts + badge updates.
@MainActor
final class InboxStore: ObservableObject {
    @Published private(set) var items: [InboxItem] = []
    @Published private(set) var unread = 0
    @Published var errorMessage: String?

    private weak var session: AppSession?
    private var pollTask: Task<Void, Never>?
    private var realtimeTask: Task<Void, Never>?
    private var knownIds = Set<String>()
    private var hasSeeded = false
    private var refreshGeneration = 0

    func bind(session: AppSession) {
        self.session = session
        startPolling()
        restartRealtime()
    }

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh(announceNew: true)
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func restartRealtime() {
        realtimeTask?.cancel()
        guard let userId = session?.userId else { return }

        realtimeTask = Task { [weak self] in
            let client = SupabaseManager.client
            let channel = client.channel("notifications:\(userId.uuidString)")
            let changes = channel.postgresChange(
                AnyAction.self,
                schema: "public",
                table: "notifications",
                filter: .eq("user_id", value: userId.uuidString)
            )

            do {
                try await channel.subscribeWithError()
            } catch {
                print("[inbox] realtime subscribe failed:", error.localizedDescription)
                return
            }

            for await _ in changes {
                guard !Task.isCancelled else { break }
                await self?.refresh(announceNew: true)
                // Other vault accounts won't get this event — poll covers them.
            }

            await client.removeChannel(channel)
        }
    }

    func refresh(announceNew: Bool = false) async {
        guard let session else { return }
        refreshGeneration += 1
        let generation = refreshGeneration

        session.reloadAccountsFromVault()
        let accounts = session.accounts
        guard !accounts.isEmpty else {
            items = []
            unread = 0
            knownIds = []
            hasSeeded = false
            await setAppBadge(0)
            return
        }

        let next = await NotificationService.listForAllAccounts(
            accounts,
            activeSession: session.session
        )
        guard generation == refreshGeneration else { return }
        session.reloadAccountsFromVault()

        if announceNew, hasSeeded {
            let fresh = next.filter { !knownIds.contains($0.id) && $0.isUnread }
            for item in fresh.prefix(5) {
                PushNotificationManager.shared.presentLocal(
                    title: item.notification.title,
                    body: item.accountName + (item.notification.body.map { " — \($0)" } ?? "")
                )
            }
        }

        items = next
        unread = NotificationService.unreadCount(next)
        knownIds = Set(next.map(\.id))
        hasSeeded = true
        errorMessage = nil
        await setAppBadge(unread)
    }

    /// Optimistic remove + server delete (no confirmation).
    /// Pending device invites must be accepted or declined first.
    func delete(_ item: InboxItem) async {
        if item.notification.isPendingInvite {
            return
        }
        guard let session,
              let account = session.accounts.first(where: { $0.id == item.accountId })
        else { return }

        let previous = items
        items.removeAll { $0.id == item.id }
        unread = NotificationService.unreadCount(items)
        knownIds = Set(items.map(\.id))
        await setAppBadge(unread)

        do {
            try await NotificationService.delete(
                notificationId: item.notification.id,
                asAccount: account
            )
        } catch {
            items = previous
            unread = NotificationService.unreadCount(items)
            knownIds = Set(items.map(\.id))
            await setAppBadge(unread)
            errorMessage = error.localizedDescription
        }
    }

    private func setAppBadge(_ count: Int) async {
        do {
            try await UNUserNotificationCenter.current().setBadgeCount(count)
        } catch {
            print("[inbox] badge update failed:", error.localizedDescription)
        }
    }
}
