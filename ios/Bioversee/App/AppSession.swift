import AuthenticationServices
import Foundation
import Supabase
import UIKit

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var accounts: [VaultAccount] = []
    @Published private(set) var isBootstrapping = true
    @Published var isAddingAccount = false
    @Published var errorMessage: String?
    @Published var oauthPendingMessage: String?

    private var authTask: Task<Void, Never>?

    init() {
        accounts = AccountVault.load()
        authTask = Task {
            await bootstrap()
            await listenForAuthChanges()
        }
    }

    deinit {
        authTask?.cancel()
    }

    var isSignedIn: Bool { session != nil || (!accounts.isEmpty && !isAddingAccount) }

    var userEmail: String? { session?.user.email ?? accounts.first?.email }

    var userId: UUID? { session?.user.id ?? accounts.first?.id }

    var displayName: String {
        if let session {
            let meta = session.user.userMetadata
            if let full = meta["full_name"]?.stringValue, !full.isEmpty { return full }
            if let name = meta["name"]?.stringValue, !name.isEmpty { return name }
        }
        return accounts.first(where: { $0.id == session?.user.id })?.displayName
            ?? accounts.first?.displayName
            ?? "Account"
    }

    var avatarURL: URL? {
        if let session {
            let meta = session.user.userMetadata
            if let raw = meta["avatar_url"]?.stringValue ?? meta["picture"]?.stringValue {
                return URL(string: raw)
            }
        }
        return accounts.first(where: { $0.id == session?.user.id })?.avatarURLValue
            ?? accounts.first?.avatarURLValue
    }

    func bootstrap() async {
        accounts = AccountVault.load()
        if let existing = try? await SupabaseManager.client.auth.session {
            await applySession(existing, persistVault: true)
        } else if let first = accounts.first {
            do {
                try await SupabaseManager.client.auth.setSession(
                    accessToken: first.accessToken,
                    refreshToken: first.refreshToken
                )
                let restored = try await SupabaseManager.client.auth.session
                await applySession(restored, persistVault: true)
            } catch {
                accounts = AccountVault.remove(first.id)
                session = nil
            }
        } else {
            session = nil
        }
        isBootstrapping = false
    }

    func listenForAuthChanges() async {
        for await (event, nextSession) in SupabaseManager.client.auth.authStateChanges {
            if let nextSession {
                await applySession(nextSession, persistVault: true)
                isAddingAccount = false
                oauthPendingMessage = nil
                await PushNotificationManager.shared.uploadTokenToAllAccounts()
            } else if event == .signedOut {
                // Keep vault; only clear active session unless vault empty.
                if accounts.isEmpty {
                    session = nil
                }
            }
            isBootstrapping = false
        }
    }

    func refreshIfNeeded() async {
        guard session != nil else { return }
        do {
            let current = try await SupabaseManager.client.auth.session
            if current.isExpired {
                let refreshed = try await SupabaseManager.client.auth.refreshSession()
                await applySession(refreshed, persistVault: true)
            } else {
                await applySession(current, persistVault: true)
            }
        } catch {
            // Keep existing session on transient errors.
        }
    }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        do {
            let next = try await SupabaseManager.client.auth.signIn(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            await applySession(next, persistVault: true)
            isAddingAccount = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async -> String? {
        errorMessage = nil
        do {
            _ = try await SupabaseManager.client.auth.signUp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            return "Check your email to confirm your account."
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func signInWithGoogle() async {
        errorMessage = nil
        oauthPendingMessage = nil
        do {
            let next = try await SupabaseManager.client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: AppConfig.oauthBridgeURL
            ) { (webAuthSession: ASWebAuthenticationSession) in
                webAuthSession.prefersEphemeralWebBrowserSession = false
            }
            await applySession(next, persistVault: true)
            isAddingAccount = false
        } catch {
            let message = error.localizedDescription
            if message.localizedCaseInsensitiveContains("cancel") { return }
            errorMessage = message
        }
    }

    func handleIncomingURL(_ url: URL) async {
        guard url.scheme == AppConfig.oauthCallbackScheme else { return }
        errorMessage = nil
        do {
            let next = try await SupabaseManager.client.auth.session(from: url)
            await applySession(next, persistVault: true)
            isAddingAccount = false
            oauthPendingMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func beginAddAccount() {
        // Snapshot current session into vault, then clear active client session for login UI.
        if let session {
            accounts = AccountVault.upsert(from: session)
        }
        isAddingAccount = true
        Task {
            try? await SupabaseManager.client.auth.signOut(scope: .local)
            self.session = nil
        }
    }

    func cancelAddAccount() async {
        isAddingAccount = false
        if session == nil, let first = accounts.first {
            do {
                try await SupabaseManager.client.auth.setSession(
                    accessToken: first.accessToken,
                    refreshToken: first.refreshToken
                )
                let restored = try await SupabaseManager.client.auth.session
                await applySession(restored, persistVault: true)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func switchToAccount(_ account: VaultAccount) async {
        errorMessage = nil
        if let session {
            accounts = AccountVault.upsert(from: session)
        }
        do {
            try await SupabaseManager.client.auth.setSession(
                accessToken: account.accessToken,
                refreshToken: account.refreshToken
            )
            let restored = try await SupabaseManager.client.auth.session
            await applySession(restored, persistVault: true)
        } catch {
            errorMessage = "Could not switch account — sign in again."
            accounts = AccountVault.remove(account.id)
        }
    }

    func signOutCurrent() async {
        errorMessage = nil
        let currentId = session?.user.id
        try? await SupabaseManager.client.auth.signOut(scope: .local)
        if let currentId {
            accounts = AccountVault.remove(currentId)
        }
        session = nil
        if let next = accounts.first {
            await switchToAccount(next)
        } else {
            await AppearanceStore.shared.loadFromCloud(userId: nil)
        }
    }

    func signOutAccount(_ account: VaultAccount) async {
        if account.id == session?.user.id {
            await signOutCurrent()
            return
        }
        accounts = AccountVault.remove(account.id)
    }

    func signOutAll() async {
        errorMessage = nil
        try? await SupabaseManager.client.auth.signOut(scope: .local)
        AccountVault.clear()
        accounts = []
        session = nil
        isAddingAccount = false
        await AppearanceStore.shared.loadFromCloud(userId: nil)
    }

    func reloadAccountsFromVault() {
        accounts = AccountVault.load()
    }

    private func applySession(_ session: Session, persistVault: Bool) async {
        self.session = session
        if persistVault {
            accounts = AccountVault.upsert(from: session)
        } else {
            accounts = AccountVault.load()
        }
        await AppearanceStore.shared.loadFromCloud(userId: session.user.id)
    }
}
