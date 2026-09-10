import SwiftUI

@main
struct BioverseeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = AppSession()
    @StateObject private var inbox = InboxStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(inbox)
                .tint(BVTheme.accent)
                .preferredColorScheme(.light)
                .onAppear {
                    PushNotificationManager.shared.bind(session: session)
                    inbox.bind(session: session)
                    PushNotificationManager.shared.requestAuthorizationAndRegister()
                }
                .onOpenURL { url in
                    Task { await session.handleIncomingURL(url) }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task {
                            await session.refreshIfNeeded()
                            await inbox.refresh(announceNew: false)
                        }
                    }
                }
                .onChange(of: session.accounts.count) { _, _ in
                    Task {
                        await PushNotificationManager.shared.uploadTokenToAllAccounts()
                        await inbox.refresh(announceNew: false)
                    }
                }
        }
    }
}
