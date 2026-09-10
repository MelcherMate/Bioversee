import SwiftUI

struct DeviceListView: View {
    @EnvironmentObject private var session: AppSession
    @State private var devices: [AccessibleDevice] = []
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var showCreate = false

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading devices…")
                } else if devices.isEmpty {
                    ContentUnavailableView(
                        "No devices yet",
                        systemImage: "cpu",
                        description: Text("Create one here, or accept a share invite from Inbox.")
                    )
                } else {
                    List(devices) { device in
                        NavigationLink(value: device) {
                            DeviceRowView(device: device)
                        }
                    }
                }
            }
            .navigationTitle("Devices")
            .navigationDestination(for: AccessibleDevice.self) { device in
                DeviceControlsView(device: device)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCreate = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateDeviceSheet {
                    Task { await refresh() }
                }
            }
            .overlay(alignment: .bottom) {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding()
                }
            }
            .task {
                await refresh()
            }
            .refreshable {
                await refresh()
            }
        }
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

private struct DeviceRowView: View {
    let device: AccessibleDevice

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: device.type.systemImage)
                .font(.title3)
                .foregroundStyle(Color.accentColor)
                .frame(width: 36, height: 36)
                .background(Color.accentColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                    .font(.headline)
                Text("\(device.type.title) · \(device.role)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
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
            Form {
                Picker("Type", selection: $type) {
                    ForEach(DeviceType.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .onChange(of: type) { _, newValue in
                    if DeviceType.allCases.map(\.title).contains(name) || name.isEmpty {
                        name = newValue.title
                    }
                }

                TextField("Name", text: $name)

                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
            .navigationTitle("Add device")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await create() }
                    }
                    .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
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
