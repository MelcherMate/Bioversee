import Realtime
import Supabase
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
    @State private var editingSliderName: String?
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

                            controlPanel

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
            await listenForActuatorChanges()
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { break }
                // Keep charts + controls in sync even if Realtime is offline.
                if busyName == nil, editingSliderName == nil {
                    await loadStates()
                }
                await loadCharts()
            }
        }
    }

    private var switchControls: [DeviceControl] {
        controls.filter { $0.kind == .switchControl }
    }

    private var sliderControls: [DeviceControl] {
        controls.filter { $0.kind == .slider }
    }

    private var controlsDisabled: Bool {
        !device.canOperate || busyName != nil
    }

    @ViewBuilder
    private var controlPanel: some View {
        if switchControls.isEmpty, sliderControls.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 14) {
                Text("Controls")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(BVTheme.textSecondary)
                    .textCase(.uppercase)
                    .tracking(0.6)

                if !switchControls.isEmpty {
                    panelSection(title: switchSectionTitle) {
                        LazyVGrid(
                            columns: [
                                GridItem(.flexible(), spacing: 8),
                                GridItem(.flexible(), spacing: 8),
                            ],
                            spacing: 8
                        ) {
                            ForEach(switchControls) { control in
                                switchCell(control)
                            }
                        }
                    }
                }

                if !sliderControls.isEmpty {
                    if !switchControls.isEmpty {
                        Rectangle()
                            .fill(BVTheme.line)
                            .frame(height: 1)
                    }
                    panelSection(title: sliderSectionTitle) {
                        VStack(spacing: 10) {
                            ForEach(sliderControls) { control in
                                sliderRow(control)
                            }
                        }
                    }
                }
            }
            .padding(14)
            .bvCard()
        }
    }

    private var switchSectionTitle: String {
        switch device.type {
        case .bioreactor: return "Pumps"
        case .membraneBioreactor: return "Flow"
        case .waterPurifier: return "Pumps"
        default: return "Switches"
        }
    }

    private var sliderSectionTitle: String {
        switch device.type {
        case .bioreactor: return "Motion"
        case .pressureVessel: return "Level"
        case .membraneBioreactor: return "Intensity"
        case .waterPurifier: return "Agitation"
        }
    }

    @ViewBuilder
    private func panelSection<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BVTheme.textTertiary)
            content()
        }
    }

    private func switchCell(_ control: DeviceControl) -> some View {
        let isOn = switchStates[control.name] ?? false
        return VStack(alignment: .leading, spacing: 10) {
            Text(control.label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(BVTheme.text)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 8) {
                Circle()
                    .fill(isOn ? BVTheme.accent : BVTheme.line)
                    .frame(width: 7, height: 7)
                Text(isOn ? "On" : "Off")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isOn ? BVTheme.accent : BVTheme.textTertiary)
                Spacer(minLength: 4)
                Toggle("", isOn: Binding(
                    get: { switchStates[control.name] ?? false },
                    set: { newValue in
                        Task { await setSwitch(control, to: newValue) }
                    }
                ))
                .labelsHidden()
                .tint(BVTheme.accent)
                .disabled(controlsDisabled)
                .scaleEffect(0.88)
                .fixedSize()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        .background(isOn ? BVTheme.accentSoft : BVTheme.fill)
        .overlay(
            RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                .stroke(isOn ? BVTheme.accentBorder : BVTheme.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
        .opacity(controlsDisabled ? 0.55 : 1)
    }

    private func sliderRow(_ control: DeviceControl) -> some View {
        let value = sliderStates[control.name] ?? control.min
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(control.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                Spacer(minLength: 8)
                Text("\(Int(value))")
                    .font(.system(size: 13, weight: .bold).monospacedDigit())
                    .foregroundStyle(BVTheme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(BVTheme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            }

            Slider(
                value: Binding(
                    get: { sliderStates[control.name] ?? control.min },
                    set: { sliderStates[control.name] = $0 }
                ),
                in: control.min...control.max,
                step: 1
            ) { editing in
                if editing {
                    editingSliderName = control.name
                } else {
                    editingSliderName = nil
                    Task { await commitSlider(control) }
                }
            }
            .tint(BVTheme.accent)
            .disabled(controlsDisabled)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(BVTheme.fill)
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
    }

    private func listenForActuatorChanges() async {
        let client = SupabaseManager.client
        let channel = client.channel("actuators:\(device.id.uuidString)")

        let switchChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "actuator_switches",
            filter: .eq("device_id", value: device.id.uuidString)
        )
        let sliderChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "actuator_sliders",
            filter: .eq("device_id", value: device.id.uuidString)
        )

        do {
            try await channel.subscribeWithError()
        } catch {
            print("[actuators] realtime subscribe failed:", error.localizedDescription)
            return
        }

        // Separate Tasks so each captures view state safely on MainActor (Swift 6).
        await withTaskGroup(of: Void.self) { group in
            group.addTask { @MainActor in
                for await _ in switchChanges {
                    guard !Task.isCancelled else { break }
                    if busyName == nil, editingSliderName == nil {
                        await loadStates()
                    }
                }
            }
            group.addTask { @MainActor in
                for await _ in sliderChanges {
                    guard !Task.isCancelled else { break }
                    if busyName == nil, editingSliderName == nil {
                        await loadStates()
                    }
                }
            }
        }

        await client.removeChannel(channel)
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
        let partner = value ? Self.exclusivePartner(of: control.name) : nil
        let partnerWasOn = partner.map { switchStates[$0] == true } ?? false

        // Optimistic UI — same exclusivity as the website.
        switchStates[control.name] = value
        if let partner, partnerWasOn {
            switchStates[partner] = false
        }

        busyName = control.name
        defer { busyName = nil }

        do {
            try await ActuatorService.setSwitch(
                deviceId: device.id,
                name: control.name,
                state: value,
                userId: userId
            )
            if let partner, partnerWasOn {
                try await ActuatorService.setSwitch(
                    deviceId: device.id,
                    name: partner,
                    state: false,
                    userId: userId
                )
            }
        } catch {
            switchStates[control.name] = previous
            if let partner, partnerWasOn {
                switchStates[partner] = true
            }
            errorMessage = error.localizedDescription
        }
    }

    /// Warm↔cold and acid↔base cannot both be on (matches web Bioreactor).
    private static func exclusivePartner(of name: String) -> String? {
        switch name {
        case "switchWarmWaterPump": return "switchColdWaterPump"
        case "switchColdWaterPump": return "switchWarmWaterPump"
        case "switchAcidPump": return "switchBasePump"
        case "switchBasePump": return "switchAcidPump"
        default: return nil
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
