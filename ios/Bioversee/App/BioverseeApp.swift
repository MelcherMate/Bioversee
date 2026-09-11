import SwiftUI

@main
struct BioverseeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = AppSession()
    @StateObject private var inbox = InboxStore()
    @ObservedObject private var appearance = AppearanceStore.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(inbox)
                .environmentObject(appearance)
                .tint(appearance.accentColor)
                .preferredColorScheme(.light)
                .id(appearance.accentHex)
                .onAppear {
                    PushNotificationManager.shared.bind(session: session)
                    inbox.bind(session: session)
                    PushNotificationManager.shared.requestAuthorizationAndRegister()
                    Task { await appearance.loadFromCloud(userId: session.userId) }
                }
                .onOpenURL { url in
                    Task { await session.handleIncomingURL(url) }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task {
                            await session.refreshIfNeeded()
                            await inbox.refresh(announceNew: false)
                            await appearance.loadFromCloud(userId: session.userId)
                        }
                    }
                }
                .onChange(of: session.accounts.count) { _, _ in
                    Task {
                        await PushNotificationManager.shared.uploadTokenToAllAccounts()
                        await inbox.refresh(announceNew: false)
                    }
                }
                .onChange(of: session.userId) { _, userId in
                    Task { await appearance.loadFromCloud(userId: userId) }
                    inbox.restartRealtime()
                    Task { await inbox.refresh(announceNew: false) }
                }
        }
    }
}
