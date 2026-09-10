import SwiftUI

struct NotificationsView: View {
    @State private var items: [AppNotification] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var busyId: UUID?

    var body: some View {
        NavigationStack {
            Group {
                if loading && items.isEmpty {
                    ProgressView("Loading inbox…")
                } else if items.isEmpty {
                    ContentUnavailableView(
                        "No notifications",
                        systemImage: "bell.slash",
                        description: Text("Device invites and updates will show up here.")
                    )
                } else {
                    List(items) { item in
                        NotificationRow(
                            item: item,
                            busy: busyId == item.id,
                            onAccept: {
                                Task { await accept(item) }
                            },
                            onDecline: {
                                Task { await decline(item) }
                            },
                            onOpen: {
                                Task { await markRead(item) }
                            }
                        )
                    }
                }
            }
            .navigationTitle("Inbox")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if unread > 0 {
                        Text("\(unread) new")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.accentColor)
                    }
                }
            }
            .task { await refresh() }
            .refreshable { await refresh() }
            .overlay(alignment: .bottom) {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding()
                }
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

private struct NotificationRow: View {
    let item: AppNotification
    let busy: Bool
    let onAccept: () -> Void
    let onDecline: () -> Void
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(item.title)
                    .font(.headline)
                if item.isUnread {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 8, height: 8)
                }
            }
            if let body = item.body, !body.isEmpty {
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(item.createdAt)
                .font(.caption2)
                .foregroundStyle(.tertiary)

            if item.kind == "device_invite", item.inviteStatus == "pending" {
                HStack {
                    Button("Accept", action: onAccept)
                        .buttonStyle(.borderedProminent)
                        .disabled(busy)
                    Button("Decline", role: .destructive, action: onDecline)
                        .disabled(busy)
                }
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
    }
}
