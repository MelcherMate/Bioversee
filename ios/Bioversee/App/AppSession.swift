import Foundation
import Supabase

@MainActor
final class AppSession: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var isBootstrapping = true
    @Published var errorMessage: String?

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
            session = try await SupabaseManager.client.auth.session
        } catch {
            session = nil
        }
        isBootstrapping = false
    }

    func listenForAuthChanges() async {
        for await (_, nextSession) in SupabaseManager.client.auth.authStateChanges {
            session = nextSession
            isBootstrapping = false
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

    func signOut() async {
        errorMessage = nil
        do {
            try await SupabaseManager.client.auth.signOut()
            session = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
