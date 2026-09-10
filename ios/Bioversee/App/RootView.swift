import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if session.isBootstrapping {
                ZStack {
                    BVScreenBackground()
                    VStack(spacing: 14) {
                        ProgressView()
                            .tint(BVTheme.accent)
                        Text("Loading Bioversee…")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(BVTheme.textSecondary)
                    }
                }
            } else if session.isAddingAccount || !session.isSignedIn {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: session.isSignedIn)
        .animation(.easeInOut(duration: 0.2), value: session.isAddingAccount)
    }
}

enum AppTab: Hashable {
    case devices
    case inbox
    case account
}

struct MainTabView: View {
    @EnvironmentObject private var inbox: InboxStore
    @State private var tab: AppTab = .devices

    var body: some View {
        ZStack(alignment: .bottom) {
            BVTheme.surface.ignoresSafeArea()

            Group {
                switch tab {
                case .devices:
                    DeviceListView()
                case .inbox:
                    NotificationsView()
                case .account:
                    AccountView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            BVTabBar(selection: $tab, unread: inbox.unread)
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
        }
        .task {
            await inbox.refresh(announceNew: false)
        }
    }
}

private struct BVTabBar: View {
    @Binding var selection: AppTab
    let unread: Int

    var body: some View {
        HStack(spacing: 6) {
            tabButton(.devices, title: "Devices", systemImage: "cpu")
            tabButton(.inbox, title: "Inbox", systemImage: "bell", badge: unread)
            tabButton(.account, title: "Account", systemImage: "person.crop.circle")
        }
        .padding(6)
        .background(.ultraThinMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.55), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.10), radius: 16, y: 6)
    }

    private func tabButton(
        _ value: AppTab,
        title: String,
        systemImage: String,
        badge: Int = 0
    ) -> some View {
        let active = selection == value
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { selection = value }
        } label: {
            VStack(spacing: 4) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: systemImage)
                        .font(.system(size: 18, weight: .semibold))
                    if badge > 0 {
                        Text(badge > 9 ? "9+" : "\(badge)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(BVTheme.accent)
                            .clipShape(Capsule())
                            .offset(x: 10, y: -8)
                    }
                }
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(active ? BVTheme.accent : BVTheme.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(active ? BVTheme.accentSoft : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}
