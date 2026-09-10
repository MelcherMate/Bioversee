import SwiftUI

@main
struct BioverseeApp: App {
    @StateObject private var session = AppSession()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(BVTheme.accent)
                .preferredColorScheme(.light)
                .onOpenURL { url in
                    Task { await session.handleIncomingURL(url) }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await session.refreshIfNeeded() }
                    }
                }
        }
    }
}
