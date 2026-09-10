import Foundation
import Supabase
import UIKit
import UserNotifications

@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()

    @Published private(set) var deviceToken: String?
    private weak var session: AppSession?

    func bind(session: AppSession) {
        self.session = session
        UNUserNotificationCenter.current().delegate = self
    }

    /// Local alert permission (works on free personal teams).
    /// Remote APNs registration is skipped until Push entitlement is enabled (paid Developer Program).
    func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) {
            granted,
            _ in
            guard granted else { return }
            // Paid team + aps-environment entitlement required:
            // UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func didRegister(deviceToken data: Data) {
        let token = data.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = token
        Task { await uploadTokenToAllAccounts(token) }
    }

    func didFailToRegister(_ error: Error) {
        print("[push] registration failed:", error.localizedDescription)
    }

    func uploadTokenToAllAccounts(_ token: String? = nil) async {
        guard let token = token ?? deviceToken else { return }
        guard let session else { return }

        let accounts = session.accounts
        let client = SupabaseManager.client
        let previous = session.session

        for account in accounts {
            do {
                try await client.auth.setSession(
                    accessToken: account.accessToken,
                    refreshToken: account.refreshToken
                )
                try await client.rpc(
                    "upsert_my_push_token",
                    params: PushTokenParams(pToken: token, pPlatform: "ios")
                ).execute()
            } catch {
                print("[push] upsert failed for \(account.email ?? "?"):", error.localizedDescription)
            }
        }

        if let previous {
            try? await client.auth.setSession(
                accessToken: previous.accessToken,
                refreshToken: previous.refreshToken
            )
        }
    }

    func presentLocal(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }
}

extension PushNotificationManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }
}

private struct PushTokenParams: Encodable {
    let pToken: String
    let pPlatform: String
    enum CodingKeys: String, CodingKey {
        case pToken = "p_token"
        case pPlatform = "p_platform"
    }
}
