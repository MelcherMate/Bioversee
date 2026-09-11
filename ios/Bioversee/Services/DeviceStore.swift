import Foundation
import Realtime
import Supabase

extension Notification.Name {
    static let bioverseeDevicesShouldRefresh = Notification.Name("bioversee.devices.shouldRefresh")
}

/// Live device list for the active account (Realtime + short poll).
@MainActor
final class DeviceStore: ObservableObject {
    @Published private(set) var devices: [AccessibleDevice] = []
    @Published private(set) var loading = true
    @Published var errorMessage: String?

    private weak var session: AppSession?
    private var pollTask: Task<Void, Never>?
    private var realtimeTask: Task<Void, Never>?
    private var refreshObserver: NSObjectProtocol?
    private var refreshGeneration = 0

    func bind(session: AppSession) {
        self.session = session
        if refreshObserver == nil {
            refreshObserver = NotificationCenter.default.addObserver(
                forName: .bioverseeDevicesShouldRefresh,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    await self?.refresh(silent: true)
                }
            }
        }
        startPolling()
        restartRealtime()
    }

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh(silent: true)
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func restartRealtime() {
        realtimeTask?.cancel()
        guard let userId = session?.userId else { return }

        realtimeTask = Task { [weak self] in
            let client = SupabaseManager.client
            let channel = client.channel("devices:\(userId.uuidString)")

            let memberChanges = channel.postgresChange(
                AnyAction.self,
                schema: "public",
                table: "device_members",
                filter: .eq("user_id", value: userId.uuidString)
            )
            let deviceChanges = channel.postgresChange(
                AnyAction.self,
                schema: "public",
                table: "devices"
            )

            do {
                try await channel.subscribeWithError()
            } catch {
                print("[devices] realtime subscribe failed:", error.localizedDescription)
                return
            }

            async let members: () = {
                for await _ in memberChanges {
                    guard !Task.isCancelled else { break }
                    await self?.refresh(silent: true)
                }
            }()
            async let devicesObs: () = {
                for await _ in deviceChanges {
                    guard !Task.isCancelled else { break }
                    await self?.refresh(silent: true)
                }
            }()

            _ = await (members, devicesObs)
            await client.removeChannel(channel)
        }
    }

    func refresh(silent: Bool = false) async {
        guard session?.session != nil || !(session?.accounts.isEmpty ?? true) else {
            devices = []
            loading = false
            return
        }

        refreshGeneration += 1
        let generation = refreshGeneration
        if !silent, devices.isEmpty { loading = true }
        errorMessage = nil

        do {
            let next = try await DeviceService.listAccessibleDevices()
            guard generation == refreshGeneration else { return }
            devices = next
        } catch {
            guard generation == refreshGeneration else { return }
            if devices.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
        loading = false
    }

    func removeLocally(_ deviceId: UUID) {
        devices.removeAll { $0.id == deviceId }
    }
}
