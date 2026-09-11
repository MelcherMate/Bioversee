import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var session: AppSession
    @EnvironmentObject private var appearance: AppearanceStore

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

                        Text("Signed-in accounts")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(BVTheme.textSecondary)
                            .padding(.horizontal, 4)

                        VStack(spacing: 0) {
                            ForEach(Array(session.accounts.enumerated()), id: \.element.id) { index, account in
                                if index > 0 {
                                    Divider().overlay(BVTheme.line)
                                }
                                AccountRow(
                                    account: account,
                                    isActive: account.id == session.session?.user.id,
                                    onSelect: {
                                        Task { await session.switchToAccount(account) }
                                    },
                                    onSignOut: {
                                        Task { await session.signOutAccount(account) }
                                    }
                                )
                            }
                        }
                        .bvCard()

                        Button {
                            session.beginAddAccount()
                        } label: {
                            Label("Add account", systemImage: "person.badge.plus")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(BVTheme.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(BVTheme.accentSoft)
                                .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("App icon")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(BVTheme.textSecondary)
                            Text("Choose your home screen icon. App colors still follow your website accent.")
                                .font(.system(size: 12))
                                .foregroundStyle(BVTheme.textTertiary)

                            HStack(spacing: 16) {
                                ForEach(AppIconOption.all) { option in
                                    let selected = appearance.selectedIconId == option.id
                                    Button {
                                        appearance.setAppIcon(option)
                                    } label: {
                                        VStack(spacing: 8) {
                                            ZStack(alignment: .bottomTrailing) {
                                                Image(option.previewImageName)
                                                    .resizable()
                                                    .scaledToFill()
                                                    .frame(width: 60, height: 60)
                                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                                    .overlay(
                                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                            .strokeBorder(
                                                                selected ? BVTheme.text : BVTheme.line,
                                                                lineWidth: selected ? 2.5 : 1
                                                            )
                                                    )
                                                    .shadow(color: .black.opacity(0.12), radius: 6, y: 3)

                                                if selected {
                                                    Image(systemName: "checkmark.circle.fill")
                                                        .font(.system(size: 18, weight: .semibold))
                                                        .foregroundStyle(BVTheme.text)
                                                        .background(Circle().fill(Color.white).padding(2))
                                                        .offset(x: 4, y: 4)
                                                }
                                            }

                                            Text(option.label)
                                                .font(.system(size: 11, weight: selected ? .semibold : .medium))
                                                .foregroundStyle(selected ? BVTheme.text : BVTheme.textTertiary)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("\(option.label) app icon")
                                    .accessibilityAddTraits(selected ? .isSelected : [])
                                }
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .padding(16)
                        .bvCard()

                        Text("Native Bioversee app for devices, controls, sensor charts, and notifications. Inbox covers every account signed in here.")
                            .font(.system(size: 13))
                            .foregroundStyle(BVTheme.textSecondary)
                            .padding(.horizontal, 4)

                        if session.accounts.count > 1 {
                            Button {
                                Task { await session.signOutAll() }
                            } label: {
                                Text("Log out all accounts")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(BVTheme.danger)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(BVTheme.danger.opacity(0.10))
                                    .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }

                        if let error = session.errorMessage {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundStyle(BVTheme.danger)
                                .padding(.horizontal, 4)
                        }
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

private struct AccountRow: View {
    let account: VaultAccount
    let isActive: Bool
    let onSelect: () -> Void
    let onSignOut: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onSelect) {
                HStack(spacing: 12) {
                    ProfileAvatar(url: account.avatarURLValue, name: account.displayName)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(account.displayName)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(BVTheme.text)
                            if isActive {
                                Text("Active")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(BVTheme.accent)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(BVTheme.accentSoft)
                                    .clipShape(Capsule())
                            }
                        }
                        Text(account.email ?? "")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(BVTheme.textSecondary)
                    }
                    Spacer(minLength: 0)
                    if !isActive {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(BVTheme.textTertiary)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Button(action: onSignOut) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(BVTheme.danger)
                    .padding(8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log out \(account.displayName)")
        }
        .padding(14)
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
        .frame(width: 44, height: 44)
        .background(BVTheme.fill)
        .clipShape(Circle())
        .overlay(Circle().stroke(BVTheme.line, lineWidth: 1))
    }

    private var initials: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(BVTheme.accent)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
