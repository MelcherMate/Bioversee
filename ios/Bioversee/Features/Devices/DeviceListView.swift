import SwiftUI

struct DeviceListView: View {
    @State private var devices: [AccessibleDevice] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var path: [AccessibleDevice] = []

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                BVTheme.surface.ignoresSafeArea()

                VStack(spacing: 0) {
                    header

                    Group {
                        if loading {
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
                            ScrollView {
                                LazyVStack(spacing: 10) {
                                    ForEach(devices) { device in
                                        Button {
                                            path.append(device)
                                        } label: {
                                            DeviceCard(device: device)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, 110)
                            }
                            .refreshable { await refresh() }
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
            .task { await refresh() }
            .toolbar(.hidden, for: .navigationBar)
        }
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

    private func refresh() async {
        loading = devices.isEmpty
        errorMessage = nil
        do {
            devices = try await DeviceService.listAccessibleDevices()
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}

private struct DeviceCard: View {
    let device: AccessibleDevice

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(BVTheme.accentSoft)
                Image(systemName: device.type.systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(BVTheme.accent)
            }
            .frame(width: 44, height: 44)

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
