import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var inbox: InboxStore

    @State private var busyId: String?

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
                    if inbox.unread > 0 {
                        Text("\(inbox.unread) new")
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

                if session.accounts.count > 1 {
                    Text("All signed-in accounts")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(BVTheme.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }

                Group {
                    if inbox.items.isEmpty {
                        BVEmptyState(
                            title: "No notifications",
                            systemImage: "bell.slash",
                            message: "Invites and updates for every signed-in account show up here."
                        )
                    } else {
                        List {
                            ForEach(inbox.items) { item in
                                NotificationCard(
                                    item: item,
                                    showAccount: session.accounts.count > 1,
                                    busy: busyId == item.id,
                                    onAccept: { Task { await accept(item) } },
                                    onDecline: { Task { await decline(item) } },
                                    onOpen: { Task { await markRead(item) } }
                                )
                                .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    if !item.notification.isPendingInvite {
                                        Button(role: .destructive) {
                                            Task { await inbox.delete(item) }
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                                }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .padding(.bottom, 90)
                        .refreshable { await inbox.refresh(announceNew: false) }
                    }
                }
            }
        }
        .overlay(alignment: .top) {
            if let errorMessage = inbox.errorMessage {
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

    private func account(for item: InboxItem) -> VaultAccount? {
        session.accounts.first { $0.id == item.accountId }
    }

    private func accept(_ item: InboxItem) async {
        guard let account = account(for: item) else {
            inbox.errorMessage = "Account not found for this invite."
            return
        }
        guard let inviteId = item.notification.inviteId else {
            inbox.errorMessage = "This invite is missing an ID. Open it on the website or ask for a new invite."
            return
        }
        busyId = item.id
        defer { busyId = nil }
        do {
            try await NotificationService.acceptInvite(inviteId: inviteId, asAccount: account)
            await inbox.refresh(announceNew: false)
        } catch {
            inbox.errorMessage = error.localizedDescription
        }
    }

    private func decline(_ item: InboxItem) async {
        guard let account = account(for: item) else {
            inbox.errorMessage = "Account not found for this invite."
            return
        }
        guard let inviteId = item.notification.inviteId else {
            inbox.errorMessage = "This invite is missing an ID. Open it on the website or ask for a new invite."
            return
        }
        busyId = item.id
        defer { busyId = nil }
        do {
            try await NotificationService.declineInvite(inviteId: inviteId, asAccount: account)
            await inbox.refresh(announceNew: false)
        } catch {
            inbox.errorMessage = error.localizedDescription
        }
    }

    private func markRead(_ item: InboxItem) async {
        guard !item.notification.isPendingInvite,
              item.notification.readAt == nil,
              let account = account(for: item)
        else { return }
        do {
            try await NotificationService.markRead(
                notificationId: item.notification.id,
                asAccount: account
            )
            await inbox.refresh(announceNew: false)
        } catch {
            // Non-blocking
        }
    }
}

private struct NotificationCard: View {
    let item: InboxItem
    let showAccount: Bool
    let busy: Bool
    let onAccept: () -> Void
    let onDecline: () -> Void
    let onOpen: () -> Void

    private var note: AppNotification { item.notification }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if showAccount {
                HStack(spacing: 8) {
                    if let url = item.accountAvatarURL {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                Circle().fill(BVTheme.fill)
                            }
                        }
                        .frame(width: 18, height: 18)
                        .clipShape(Circle())
                    }
                    Text(item.accountName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BVTheme.accent)
                    if let email = item.accountEmail {
                        Text(email)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(BVTheme.textTertiary)
                            .lineLimit(1)
                    }
                }
            }

            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top) {
                        Text(note.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(BVTheme.text)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        if item.isUnread {
                            Circle()
                                .fill(BVTheme.accent)
                                .frame(width: 8, height: 8)
                                .padding(.top, 5)
                        }
                    }

                    if let body = note.body, !body.isEmpty {
                        Text(body)
                            .font(.system(size: 13))
                            .foregroundStyle(BVTheme.textSecondary)
                            .multilineTextAlignment(.leading)
                    }

                    Text(note.createdAt)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(BVTheme.textTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(note.isPendingInvite)

            if note.isPendingInvite {
                HStack(spacing: 8) {
                    Button(action: onAccept) {
                        Text(busy ? "Working…" : "Accept")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(BVTheme.accent)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.borderless)
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
                    .buttonStyle(.borderless)
                    .disabled(busy)
                }
            }
        }
        .padding(16)
        .bvCard()
    }
}
