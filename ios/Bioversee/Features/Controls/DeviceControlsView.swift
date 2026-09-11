import SwiftUI

struct DeviceControlsView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.dismiss) private var dismiss

    let device: AccessibleDevice

    @State private var switchStates: [String: Bool] = [:]
    @State private var sliderStates: [String: Double] = [:]
    @State private var chartPoints: [String: [SensorReading]] = [:]
    @State private var loading = true
    @State private var busyName: String?
    @State private var errorMessage: String?

    private var controls: [DeviceControl] {
        ControlCatalog.controls(for: device.type)
    }

    private var chartSpecs: [SensorChartSpec] {
        SensorCatalog.charts(for: device.type)
    }

    var body: some View {
        ZStack {
            BVTheme.surface.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(BVTheme.text)
                            .frame(width: 36, height: 36)
                            .background(BVTheme.fill)
                            .clipShape(Circle())
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(device.name)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(BVTheme.text)
                        Text("\(device.type.title) · \(device.role)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(BVTheme.textSecondary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)

                if loading && switchStates.isEmpty && chartPoints.isEmpty {
                    ProgressView()
                        .tint(BVTheme.accent)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if !device.canOperate {
                                Text("Viewer access — controls are read-only.")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(BVTheme.textSecondary)
                                    .padding(14)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(BVTheme.fill)
                                    .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                            }

                            ForEach(chartSpecs) { spec in
                                SensorChartCard(
                                    label: spec.label,
                                    points: chartPoints[spec.name] ?? []
                                )
                            }

                            ForEach(controls) { control in
                                controlCard(control)
                            }

                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.system(size: 13))
                                    .foregroundStyle(BVTheme.danger)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 110)
                    }
                    .refreshable { await reloadAll() }
                }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await reloadAll()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard !Task.isCancelled else { break }
                await loadCharts()
            }
        }
    }

    @ViewBuilder
    private func controlCard(_ control: DeviceControl) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            switch control.kind {
            case .switchControl:
                Toggle(isOn: Binding(
                    get: { switchStates[control.name] ?? false },
                    set: { newValue in
                        Task { await setSwitch(control, to: newValue) }
                    }
                )) {
                    Text(control.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(BVTheme.text)
                }
                .tint(BVTheme.accent)
                .disabled(!device.canOperate || busyName != nil)

            case .slider:
                HStack {
                    Text(control.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(BVTheme.text)
                    Spacer()
                    Text("\(Int(sliderStates[control.name] ?? 0))")
                        .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        .foregroundStyle(BVTheme.textSecondary)
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
                        Task { await commitSlider(control) }
                    }
                }
                .tint(BVTheme.accent)
                .disabled(!device.canOperate || busyName != nil)
            }
        }
        .padding(16)
        .bvCard()
    }

    private func reloadAll() async {
        await loadStates()
        await loadCharts()
    }

    private func loadStates() async {
        let showSpinner = switchStates.isEmpty
        if showSpinner { loading = true }
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

    private func loadCharts() async {
        guard !chartSpecs.isEmpty else {
            chartPoints = [:]
            return
        }

        var next: [String: [SensorReading]] = [:]
        do {
            for spec in chartSpecs {
                let rows = try await SensorService.readings(deviceId: device.id, name: spec.name)
                next[spec.name] = SensorService.chartPoints(from: rows)
            }
            chartPoints = next
        } catch {
            // Keep last good chart data; surface error lightly.
            if chartPoints.isEmpty {
                errorMessage = error.localizedDescription
            }
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
