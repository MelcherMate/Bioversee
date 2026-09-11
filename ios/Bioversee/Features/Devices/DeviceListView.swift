import SwiftUI

struct DeviceListView: View {
    @EnvironmentObject private var devicesStore: DeviceStore
    @State private var path: [AccessibleDevice] = []
    @State private var devicePendingRemoval: AccessibleDevice?
    @State private var removing = false

    private var devices: [AccessibleDevice] { devicesStore.devices }
    private var loading: Bool { devicesStore.loading }
    private var errorMessage: String? { devicesStore.errorMessage }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                BVTheme.surface.ignoresSafeArea()

                VStack(spacing: 0) {
                    header

                    Group {
                        if loading && devices.isEmpty {
                            ProgressView()
                                .tint(BVTheme.accent)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        } else if devices.isEmpty {
                            BVEmptyState(
                                title: "No devices yet",
                                systemImage: "cpu",
                                message: "Create a device on the web app, or accept a share invite from Inbox."
                            )
                        } else {
                            List {
                                ForEach(devices) { device in
                                    Button {
                                        path.append(device)
                                    } label: {
                                        DeviceCard(device: device)
                                    }
                                    .buttonStyle(.plain)
                                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            devicePendingRemoval = device
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                                }
                            }
                            .listStyle(.plain)
                            .scrollContentBackground(.hidden)
                            .padding(.bottom, 90)
                            .refreshable { await devicesStore.refresh(silent: false) }
                        }
                    }
                }
            }
            .navigationDestination(for: AccessibleDevice.self) { device in
                DeviceControlsView(device: device)
            }
            .overlay(alignment: .top) {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(BVTheme.danger)
                        .padding(10)
                        .background(BVTheme.card)
                        .clipShape(Capsule())
                        .padding(.top, 8)
                }
            }
            .confirmationDialog(
                removalTitle,
                isPresented: Binding(
                    get: { devicePendingRemoval != nil },
                    set: { if !$0 { devicePendingRemoval = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button(removalConfirmLabel, role: .destructive) {
                    guard let device = devicePendingRemoval else { return }
                    Task { await confirmRemoval(device) }
                }
                Button("Cancel", role: .cancel) {
                    devicePendingRemoval = nil
                }
            } message: {
                Text(removalMessage)
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private var removalTitle: String {
        guard let device = devicePendingRemoval else { return "Remove device" }
        return device.isOwner ? "Delete “\(device.name)”?" : "Remove “\(device.name)”?"
    }

    private var removalMessage: String {
        guard let device = devicePendingRemoval else { return "" }
        if device.isOwner {
            return "This permanently deletes the device and its data for everyone. This can’t be undone."
        }
        return "You’ll lose access to this shared device. The owner’s copy stays."
    }

    private var removalConfirmLabel: String {
        devicePendingRemoval?.isOwner == true ? "Delete Device" : "Remove Access"
    }

    private var header: some View {
        HStack(spacing: 12) {
            HStack(spacing: 10) {
                Circle()
                    .fill(BVTheme.accent)
                    .frame(width: 10, height: 10)
                    .shadow(color: BVTheme.accentMuted, radius: 4)
                Text("Bioversee")
                    .font(.system(size: 17, weight: .semibold))
                    .tracking(-0.4)
                    .foregroundStyle(BVTheme.text)
            }
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.55), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }

    private func confirmRemoval(_ device: AccessibleDevice) async {
        removing = true
        defer {
            removing = false
            devicePendingRemoval = nil
        }
        do {
            try await DeviceService.removeFromAccount(device)
            withAnimation {
                devicesStore.removeLocally(device.id)
            }
            path.removeAll { $0.id == device.id }
            await devicesStore.refresh(silent: true)
        } catch {
            devicesStore.errorMessage = error.localizedDescription
        }
    }
}

private struct DeviceCard: View {
    let device: AccessibleDevice

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(device.name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                Text("\(device.type.title) · \(device.role)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(BVTheme.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(BVTheme.textTertiary)
        }
        .padding(14)
        .bvCard()
    }
}
