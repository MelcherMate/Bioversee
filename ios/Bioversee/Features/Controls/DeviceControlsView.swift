import SwiftUI

struct DeviceControlsView: View {
    @EnvironmentObject private var session: AppSession

    let device: AccessibleDevice

    @State private var switchStates: [String: Bool] = [:]
    @State private var sliderStates: [String: Double] = [:]
    @State private var loading = true
    @State private var busyName: String?
    @State private var errorMessage: String?

    private var controls: [DeviceControl] {
        ControlCatalog.controls(for: device.type)
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Type", value: device.type.title)
                LabeledContent("Role", value: device.role)
                if !device.canOperate {
                    Text("Viewer access — controls are read-only.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Controls") {
                ForEach(controls) { control in
                    switch control.kind {
                    case .switchControl:
                        Toggle(
                            control.label,
                            isOn: Binding(
                                get: { switchStates[control.name] ?? false },
                                set: { newValue in
                                    Task { await setSwitch(control, to: newValue) }
                                }
                            )
                        )
                        .disabled(!device.canOperate || busyName != nil)

                    case .slider:
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(control.label)
                                Spacer()
                                Text("\(Int(sliderStates[control.name] ?? 0))")
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                            Slider(
                                value: Binding(
                                    get: { sliderStates[control.name] ?? 0 },
                                    set: { sliderStates[control.name] = $0 }
                                ),
                                in: control.min...control.max,
                                step: 1
                            ) { editing in
                                if !editing {
                                    Task {
                                        await commitSlider(control)
                                    }
                                }
                            }
                            .disabled(!device.canOperate || busyName != nil)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(device.name)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if loading {
                ProgressView()
            }
        }
        .task {
            await loadStates()
        }
        .refreshable {
            await loadStates()
        }
    }

    private func loadStates() async {
        loading = true
        errorMessage = nil
        defer { loading = false }

        var nextSwitches: [String: Bool] = [:]
        var nextSliders: [String: Double] = [:]

        do {
            for control in controls {
                switch control.kind {
                case .switchControl:
                    nextSwitches[control.name] = try await ActuatorService.latestSwitch(
                        deviceId: device.id,
                        name: control.name
                    )
                case .slider:
                    nextSliders[control.name] = try await ActuatorService.latestSlider(
                        deviceId: device.id,
                        name: control.name
                    )
                }
            }
            switchStates = nextSwitches
            sliderStates = nextSliders
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func setSwitch(_ control: DeviceControl, to value: Bool) async {
        guard device.canOperate, let userId = session.userId else { return }
        let previous = switchStates[control.name] ?? false
        switchStates[control.name] = value
        busyName = control.name
        defer { busyName = nil }

        do {
            try await ActuatorService.setSwitch(
                deviceId: device.id,
                name: control.name,
                state: value,
                userId: userId
            )
        } catch {
            switchStates[control.name] = previous
            errorMessage = error.localizedDescription
        }
    }

    private func commitSlider(_ control: DeviceControl) async {
        guard device.canOperate, let userId = session.userId else { return }
        let value = sliderStates[control.name] ?? 0
        busyName = control.name
        defer { busyName = nil }

        do {
            try await ActuatorService.setSlider(
                deviceId: device.id,
                name: control.name,
                state: value,
                userId: userId
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
