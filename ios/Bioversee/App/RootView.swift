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
            } else if session.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: session.isSignedIn)
    }
}

enum AppTab: Hashable {
    case devices
    case inbox
    case account
}

struct MainTabView: View {
    @State private var tab: AppTab = .devices
    @State private var unread = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            BVTheme.surface.ignoresSafeArea()

            Group {
                switch tab {
                case .devices:
                    DeviceListView()
                case .inbox:
                    NotificationsView(onUnreadChange: { unread = $0 })
                case .account:
                    AccountView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            BVTabBar(selection: $tab, unread: unread)
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
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

struct AccountView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            ZStack {
                BVTheme.surface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Account")
                            .font(.system(size: 28, weight: .semibold))
                            .tracking(-0.6)
                            .foregroundStyle(BVTheme.text)
                            .padding(.horizontal, 4)

                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 14) {
                                ProfileAvatar(
                                    url: session.avatarURL,
                                    name: session.displayName
                                )

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(session.displayName)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(BVTheme.text)
                                    Text(session.userEmail ?? "")
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(BVTheme.textSecondary)
                                }
                            }

                            Text("Native Bioversee app for devices, controls, and notifications. Charts stay on the web.")
                                .font(.system(size: 13))
                                .foregroundStyle(BVTheme.textSecondary)
                        }
                        .padding(18)
                        .bvCard()

                        Button {
                            Task { await session.signOut() }
                        } label: {
                            Text("Log out")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(BVTheme.danger)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(BVTheme.danger.opacity(0.10))
                                .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 110)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private struct ProfileAvatar: View {
    let url: URL?
    let name: String

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        initials
                    case .empty:
                        ProgressView()
                    @unknown default:
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: 48, height: 48)
        .background(BVTheme.fill)
        .clipShape(Circle())
        .overlay(Circle().stroke(BVTheme.line, lineWidth: 1))
    }

    private var initials: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(BVTheme.accent)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
