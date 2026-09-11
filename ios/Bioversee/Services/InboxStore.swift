import Foundation
import UIKit
import UserNotifications

/// Shared inbox across all signed-in accounts + badge updates.
@MainActor
final class InboxStore: ObservableObject {
    @Published private(set) var items: [InboxItem] = []
    @Published private(set) var unread = 0
    @Published var errorMessage: String?

    private weak var session: AppSession?
    private var pollTask: Task<Void, Never>?
    private var knownIds = Set<String>()
    private var hasSeeded = false

    func bind(session: AppSession) {
        self.session = session
        startPolling()
    }

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh(announceNew: true)
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh(announceNew: Bool = false) async {
        guard let session else { return }
        session.reloadAccountsFromVault()
        let accounts = session.accounts
        guard !accounts.isEmpty else {
            items = []
            unread = 0
            knownIds = []
            hasSeeded = false
            UIApplication.shared.applicationIconBadgeNumber = 0
            return
        }

        let next = await NotificationService.listForAllAccounts(
            accounts,
            activeSession: session.session
        )
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
        UIApplication.shared.applicationIconBadgeNumber = unread
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
        UIApplication.shared.applicationIconBadgeNumber = unread

        do {
            try await NotificationService.delete(
                notificationId: item.notification.id,
                asAccount: account
            )
        } catch {
            items = previous
            unread = NotificationService.unreadCount(items)
            knownIds = Set(items.map(\.id))
            UIApplication.shared.applicationIconBadgeNumber = unread
            errorMessage = error.localizedDescription
        }
    }
}
