import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: AppSession

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var infoMessage: String?

    private enum Mode: Hashable {
        case signIn
        case signUp
    }

    var body: some View {
        ZStack {
            BVScreenBackground()

            ScrollView {
                VStack(spacing: 0) {
                    // Header
                    HStack(alignment: .top, spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(BVTheme.accentBorder, lineWidth: 1)
                                )
                            Image("BioverseeLogo")
                                .resizable()
                                .renderingMode(.original)
                                .scaledToFit()
                                .frame(width: 34, height: 34)
                        }
                        .frame(width: 48, height: 48)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("BIOVERSEE")
                                .font(.system(size: 11, weight: .bold))
                                .tracking(1.4)
                                .foregroundStyle(BVTheme.textSecondary)
                            Text(session.isAddingAccount ? "Add account" : "Welcome")
                                .font(.system(size: 24, weight: .semibold))
                                .tracking(-0.5)
                                .foregroundStyle(BVTheme.text)
                            Text(
                                session.isAddingAccount
                                    ? "Sign in with another Bioversee account. Inbox stays shared across all of them."
                                    : "Sign in to monitor and control your Bioversee devices."
                            )
                                .font(.system(size: 14))
                                .foregroundStyle(BVTheme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                        if session.isAddingAccount {
                            Button("Cancel") {
                                Task { await session.cancelAddAccount() }
                            }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(BVTheme.accent)
                        }
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BVTheme.card)

                    Divider().overlay(BVTheme.line)

                    VStack(spacing: 16) {
                        BVSegmented(
                            options: [(.signIn, "Sign in"), (.signUp, "Sign up")],
                            selection: $mode
                        )

                        VStack(spacing: 14) {
                            BVField(
                                label: "Email",
                                text: $email,
                                keyboard: .emailAddress,
                                contentType: .username
                            )
                            BVField(
                                label: "Password",
                                text: $password,
                                isSecure: true,
                                contentType: mode == .signIn ? .password : .newPassword
                            )
                        }

                        BVPrimaryButton(
                            title: mode == .signIn ? "Sign in" : "Create account",
                            busy: busy,
                            enabled: !email.isEmpty && password.count >= 6
                        ) {
                            Task { await submit() }
                        }

                        HStack(spacing: 12) {
                            Rectangle().fill(BVTheme.line).frame(height: 1)
                            Text("or")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(BVTheme.textTertiary)
                            Rectangle().fill(BVTheme.line).frame(height: 1)
                        }

                        BVSecondaryButton(
                            title: "Continue with Google",
                            systemImage: "g.circle.fill",
                            busy: busy
                        ) {
                            Task { await signInWithGoogle() }
                        }

                if let pending = session.oauthPendingMessage {
                    Text(pending)
                        .font(.system(size: 13))
                        .foregroundStyle(BVTheme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let infoMessage {
                    Text(infoMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(BVTheme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let error = session.errorMessage {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundStyle(BVTheme.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                        Text("Demo site for Bioversee prototypes")
                            .font(.system(size: 12))
                            .foregroundStyle(BVTheme.textTertiary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 4)
                    }
                    .padding(22)
                    .background(BVTheme.surfaceElevated)
                }
                .bvCard()
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
            }
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        infoMessage = nil
        switch mode {
        case .signIn:
            await session.signIn(email: email, password: password)
        case .signUp:
            infoMessage = await session.signUp(email: email, password: password)
        }
    }

    private func signInWithGoogle() async {
        busy = true
        defer { busy = false }
        infoMessage = nil
        await session.signInWithGoogle()
    }
}
