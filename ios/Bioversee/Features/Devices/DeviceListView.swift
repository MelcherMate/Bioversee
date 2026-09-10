import SwiftUI

struct DeviceListView: View {
    @State private var devices: [AccessibleDevice] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showCreate = false
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
                                message: "Create one with +, or accept a share invite from Inbox."
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
            .sheet(isPresented: $showCreate) {
                CreateDeviceSheet {
                    Task { await refresh() }
                }
                .presentationDetents([.medium, .large])
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
            Button {
                Task { await refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                    .frame(width: 36, height: 36)
                    .background(BVTheme.fill)
                    .clipShape(Circle())
            }
            Button {
                showCreate = true
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(BVTheme.accent)
                    .frame(width: 36, height: 36)
                    .background(BVTheme.accentSoft)
                    .clipShape(Circle())
            }
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

private struct CreateDeviceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var type: DeviceType = .bioreactor
    @State private var name = "Bioreactor"
    @State private var busy = false
    @State private var errorMessage: String?

    var onCreated: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                BVTheme.surface.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Type")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(BVTheme.textTertiary)
                            .textCase(.uppercase)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                            ForEach(DeviceType.allCases) { item in
                                Button {
                                    type = item
                                    if DeviceType.allCases.map(\.title).contains(name) || name.isEmpty {
                                        name = item.title
                                    }
                                } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: item.systemImage)
                                        Text(item.title)
                                            .font(.system(size: 13, weight: .semibold))
                                            .lineLimit(2)
                                            .minimumScaleFactor(0.85)
                                    }
                                    .foregroundStyle(type == item ? BVTheme.accent : BVTheme.text)
                                    .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
                                    .padding(10)
                                    .background(type == item ? BVTheme.accentSoft : BVTheme.fill)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(type == item ? BVTheme.accent : Color.clear, lineWidth: 1.5)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        BVField(label: "Name", text: $name)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 13))
                                .foregroundStyle(BVTheme.danger)
                        }

                        BVPrimaryButton(
                            title: "Create device",
                            busy: busy,
                            enabled: !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ) {
                            Task { await create() }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Add device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func create() async {
        busy = true
        defer { busy = false }
        do {
            _ = try await DeviceService.createDevice(
                type: type,
                name: name.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            onCreated()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
