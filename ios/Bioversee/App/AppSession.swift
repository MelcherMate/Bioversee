import AuthenticationServices
import Foundation
import Supabase
import UIKit

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var isBootstrapping = true
    @Published var errorMessage: String?
    @Published var oauthPendingMessage: String?

    private var authTask: Task<Void, Never>?

    init() {
        authTask = Task {
            await bootstrap()
            await listenForAuthChanges()
        }
    }

    deinit {
        authTask?.cancel()
    }

    var isSignedIn: Bool { session != nil }

    var userEmail: String? {
        session?.user.email
    }

    var userId: UUID? {
        session?.user.id
    }

    func bootstrap() async {
        do {
            // Keychain-backed session with refresh — no 7-day web vault cut-off on iOS.
            let current = try await SupabaseManager.client.auth.session
            if current.isExpired {
                session = try await SupabaseManager.client.auth.refreshSession()
            } else {
                session = current
            }
        } catch {
            session = nil
        }
        isBootstrapping = false
    }

    func listenForAuthChanges() async {
        for await (_, nextSession) in SupabaseManager.client.auth.authStateChanges {
            session = nextSession
            isBootstrapping = false
            if nextSession != nil {
                oauthPendingMessage = nil
            }
        }
    }

    func refreshIfNeeded() async {
        guard session != nil else { return }
        do {
            let current = try await SupabaseManager.client.auth.session
            if current.isExpired {
                session = try await SupabaseManager.client.auth.refreshSession()
            } else {
                session = current
            }
        } catch {
            // Keep existing session on transient errors — never force weekly logout.
        }
    }

    func signIn(email: String, password: String) async {
        errorMessage = nil
        do {
            session = try await SupabaseManager.client.auth.signIn(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
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

    /**
     Google → HTTPS bridge (`/ios-auth`) → deep link into the app.

     Supabase must allow `https://bioversee.com/ios-auth` (Additional Redirect URLs).
     The bridge page then navigates to `com.bioversee.app://login-callback…`, which
     ASWebAuthenticationSession captures so control returns to the native app.
     */
    func signInWithGoogle() async {
        errorMessage = nil
        oauthPendingMessage = nil
        do {
            session = try await SupabaseManager.client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: AppConfig.oauthBridgeURL
            ) { (webAuthSession: ASWebAuthenticationSession) in
                webAuthSession.prefersEphemeralWebBrowserSession = false
            }
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
            session = try await SupabaseManager.client.auth.session(from: url)
            oauthPendingMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        errorMessage = nil
        oauthPendingMessage = nil
        do {
            try await SupabaseManager.client.auth.signOut()
            session = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
