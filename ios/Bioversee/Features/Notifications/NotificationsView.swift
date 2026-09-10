import SwiftUI

struct NotificationsView: View {
    var onUnreadChange: (Int) -> Void = { _ in }

    @State private var items: [AppNotification] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var busyId: UUID?

    var body: some View {
        ZStack {
            BVTheme.surface.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Text("Inbox")
                        .font(.system(size: 28, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(BVTheme.text)
                    Spacer()
                    if unread > 0 {
                        Text("\(unread) new")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(BVTheme.accent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(BVTheme.accentSoft)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 8)

                Group {
                    if loading && items.isEmpty {
                        ProgressView()
                            .tint(BVTheme.accent)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if items.isEmpty {
                        BVEmptyState(
                            title: "No notifications",
                            systemImage: "bell.slash",
                            message: "Device invites and updates will show up here."
                        )
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                ForEach(items) { item in
                                    NotificationCard(
                                        item: item,
                                        busy: busyId == item.id,
                                        onAccept: { Task { await accept(item) } },
                                        onDecline: { Task { await decline(item) } },
                                        onOpen: { Task { await markRead(item) } }
                                    )
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 110)
                        }
                        .refreshable { await refresh() }
                    }
                }
            }
        }
        .task { await refresh() }
        .overlay(alignment: .top) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(BVTheme.danger)
                    .padding(10)
                    .background(BVTheme.card)
                    .clipShape(Capsule())
                    .padding(.top, 8)
            }
        }
    }

    private var unread: Int {
        NotificationService.unreadCount(items)
    }

    private func refresh() async {
        loading = items.isEmpty
        errorMessage = nil
        do {
            items = try await NotificationService.list()
            onUnreadChange(unread)
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }

    private func accept(_ item: AppNotification) async {
        guard let inviteId = item.inviteId else { return }
        busyId = item.id
        defer { busyId = nil }
        do {
            _ = try await NotificationService.acceptInvite(inviteId: inviteId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func decline(_ item: AppNotification) async {
        guard let inviteId = item.inviteId else { return }
        busyId = item.id
        defer { busyId = nil }
        do {
            try await NotificationService.declineInvite(inviteId: inviteId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markRead(_ item: AppNotification) async {
        guard item.readAt == nil else { return }
        do {
            try await NotificationService.markRead(notificationId: item.id)
            await refresh()
        } catch {
            // Non-blocking
        }
    }
}

private struct NotificationCard: View {
    let item: AppNotification
    let busy: Bool
    let onAccept: () -> Void
    let onDecline: () -> Void
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                Text(item.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                Spacer()
                if item.isUnread {
                    Circle()
                        .fill(BVTheme.accent)
                        .frame(width: 8, height: 8)
                        .padding(.top, 5)
                }
            }

            if let body = item.body, !body.isEmpty {
                Text(body)
                    .font(.system(size: 13))
                    .foregroundStyle(BVTheme.textSecondary)
            }

            Text(item.createdAt)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(BVTheme.textTertiary)

            if item.kind == "device_invite", item.inviteStatus == "pending" {
                HStack(spacing: 8) {
                    Button(action: onAccept) {
                        Text("Accept")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(BVTheme.accent)
                            .clipShape(Capsule())
                    }
                    .disabled(busy)

                    Button(action: onDecline) {
                        Text("Decline")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(BVTheme.danger)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(BVTheme.danger.opacity(0.10))
                            .clipShape(Capsule())
                    }
                    .disabled(busy)
                }
            }
        }
        .padding(16)
        .bvCard()
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
    }
}
