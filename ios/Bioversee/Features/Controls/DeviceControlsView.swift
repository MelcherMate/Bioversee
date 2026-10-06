import Realtime
import Supabase
import SwiftUI
import UIKit

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
    /// Ignore remote refreshes briefly after a local write (echo / race).
    @State private var ignoreRemoteUntil: Date = .distantPast

    // Bioreactor water level (dose Fill/Drain — matches web).
    @State private var waterLevelPercent: Double = 92
    @State private var transferAmountText = ""
    @State private var levelBusy = false
    @State private var levelFeedback: String?
    @State private var levelFeedbackIsWarning = false
    @State private var levelTransferTask: Task<Void, Never>?
    @FocusState private var amountFieldFocused: Bool
    @ObservedObject private var keyboard = KeyboardObserver.shared
    /// How far the scroll viewport sits above the physical screen bottom (home indicator, etc.).
    @State private var scrollBottomToScreen: CGFloat = 0

    private let waterLevelKey = "water_level"
    private let waterLevelActionsId = "waterLevelActions"
    /// Matches web `layout.impeller.minFillPercent` (ceil(0.202 * 100)).
    private let rotorMinFillPercent: Double = 21
    /// Matches web `layout.aerator.minFillPercent` (sparger at 10%).
    private let aeratorMinFillPercent: Double = 10
    /// Same as horizontal page padding — gap between water-level card and number pad.
    private let sidePadding: CGFloat = 16

    private var controls: [DeviceControl] {
        ControlCatalog.controls(for: device.type)
    }

    private var chartSpecs: [SensorChartSpec] {
        SensorCatalog.charts(for: device.type)
    }

    /// Spacer under the water-level card while the pad is open:
    /// keyboard coverage of this scroll view + the same 16pt we use on the sides.
    private var waterLevelKeyboardSpacer: CGFloat {
        guard keyboard.isVisible, keyboard.height > 1 else { return 0 }
        let covered = max(0, keyboard.height - scrollBottomToScreen)
        return covered + sidePadding
    }

    private var scrollBottomPadding: CGFloat {
        // Keyboard lift lives on the water-level card itself; only reserve tab-bar room when idle.
        keyboard.isVisible ? sidePadding : MainTabView.tabBarClearance + sidePadding
    }

    var body: some View {
        ZStack {
            BVTheme.surface.ignoresSafeArea()

            ZStack(alignment: .top) {
                if loading && switchStates.isEmpty && chartPoints.isEmpty {
                    ProgressView()
                        .tint(BVTheme.accent)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollViewReader { proxy in
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
                            .padding(.horizontal, sidePadding)
                            .padding(.top, 72)
                            .padding(.bottom, scrollBottomPadding)
                        }
                        .background {
                            GeometryReader { geo in
                                let gap = UIScreen.main.bounds.maxY - geo.frame(in: .global).maxY
                                Color.clear
                                    .onAppear { scrollBottomToScreen = max(0, gap) }
                                    .onChange(of: gap) { _, newGap in
                                        scrollBottomToScreen = max(0, newGap)
                                    }
                            }
                        }
                        // Swipe the page to dismiss the pad.
                        .scrollDismissesKeyboard(.interactively)
                        .refreshable { await reloadAll() }
                        .onChange(of: amountFieldFocused) { _, focused in
                            guard focused else { return }
                            pinWaterLevelAboveKeyboard(proxy)
                        }
                        .onChange(of: keyboard.height) { _, height in
                            guard amountFieldFocused, height > 0 else { return }
                            pinWaterLevelAboveKeyboard(proxy)
                        }
                        .onChange(of: waterLevelKeyboardSpacer) { _, spacer in
                            guard amountFieldFocused, spacer > 0 else { return }
                            pinWaterLevelAboveKeyboard(proxy)
                        }
                    }
                }

                deviceHeader
            }
        }
        // We lift the water-level card ourselves — don't let UIKit also push the page.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await reloadAll()
            await listenForActuatorChanges()
        }
        .onDisappear {
            levelTransferTask?.cancel()
            levelTransferTask = nil
            levelBusy = false
            amountFieldFocused = false
        }
        .onChange(of: waterLevelPercent) { oldValue, newValue in
            // Only shut off mixer/aerator when the level drops — never when
            // applying a remote setpoint, or the two clients fight over 0.
            guard newValue + 0.05 < oldValue else { return }
            Task { await enforceLevelGuards() }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                guard !Task.isCancelled else { break }
                // Water level must always track the web app so mixer/aerator
                // enablement stays correct even during local write ignore windows.
                await refreshWaterLevel()
                if shouldApplyRemoteRefresh {
                    await loadStates(includeWaterLevel: false)
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

    private var readOnly: Bool { !device.canOperate }

    private var deviceHeader: some View {
        HStack(spacing: 12) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                    .frame(width: 36, height: 36)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.55), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Go back")

            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                    .lineLimit(1)
                Text("\(device.type.title) · \(device.role)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(BVTheme.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                // 50% frosted glass: material + half-opaque surface.
                Rectangle().fill(.ultraThinMaterial)
                Rectangle().fill(BVTheme.surface.opacity(0.50))
            }
            .ignoresSafeArea(edges: .top)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(BVTheme.line)
                .frame(height: 1)
        }
    }

    private var shouldApplyRemoteRefresh: Bool {
        busyName == nil
            && editingSliderName == nil
            && !levelBusy
            && Date() >= ignoreRemoteUntil
    }

    private var showsWaterLevelDose: Bool {
        device.type == .bioreactor
    }

    private var tankCapacityLiters: Double {
        max(1, device.tankCapacityLiters)
    }

    private func pinWaterLevelAboveKeyboard(_ proxy: ScrollViewProxy) {
        // Spacer under the card is part of the scroll target, so .bottom parks
        // the card exactly sidePadding above the pad.
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.22)) {
                proxy.scrollTo(waterLevelActionsId, anchor: .bottom)
            }
        }
    }

    @ViewBuilder
    private var controlPanel: some View {
        if switchControls.isEmpty, sliderControls.isEmpty, !showsWaterLevelDose {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 14) {
                Text("Controls")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(BVTheme.textSecondary)
                    .textCase(.uppercase)
                    .tracking(0.6)

                if !switchControls.isEmpty {
                    nestedControlPanel(title: switchSectionTitle) {
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
                    nestedControlPanel(title: sliderSectionTitle) {
                        VStack(spacing: 10) {
                            ForEach(sliderControls) { control in
                                sliderRow(control)
                            }
                        }
                    }
                }

                if showsWaterLevelDose {
                    waterLevelDoseSection
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
        case .bioreactor: return "Mixing"
        case .pressureVessel: return "Level"
        case .membraneBioreactor: return "Intensity"
        case .waterPurifier: return "Agitation"
        }
    }

    /// Nested fill panel matching website Mixing / Pumps / Water level cards.
    @ViewBuilder
    private func nestedControlPanel<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BVTheme.textTertiary)
            content()
        }
        .padding(12)
        .background(BVTheme.fill)
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusPanel, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: BVTheme.radiusPanel, style: .continuous)
                .stroke(BVTheme.line, lineWidth: 1)
        )
    }

    private func minFillPercent(for control: DeviceControl) -> Double? {
        switch control.name {
        case "rotor": return rotorMinFillPercent
        case "aerator": return aeratorMinFillPercent
        default: return nil
        }
    }

    private func isLevelTooLow(for control: DeviceControl) -> Bool {
        guard let minFill = minFillPercent(for: control) else { return false }
        return waterLevelPercent <= minFill
    }

    private func sliderInactive(_ control: DeviceControl) -> Bool {
        readOnly || isLevelTooLow(for: control)
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
                .disabled(readOnly)
                .frame(width: 51, height: 31)
                .scaleEffect(0.88)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        .background(isOn ? BVTheme.accentSoft : BVTheme.card)
        .overlay(
            RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                .stroke(isOn ? BVTheme.accentBorder : BVTheme.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
        // Avoid implicit layout/opacity animations that make the panel pulse.
        .transaction { $0.animation = nil }
        .opacity(readOnly ? 0.55 : 1)
    }

    private func sliderRow(_ control: DeviceControl) -> some View {
        let value = sliderStates[control.name] ?? control.min
        let inactive = sliderInactive(control)
        let step = max(control.step, 0.001)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(control.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(inactive ? BVTheme.textTertiary : BVTheme.text)
                Spacer(minLength: 8)
                Text("\(Int(value.rounded()))\(control.unit.map { " \($0)" } ?? "")")
                    .font(.system(size: 13, weight: .bold).monospacedDigit())
                    .foregroundStyle(inactive ? BVTheme.textTertiary : BVTheme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(inactive ? BVTheme.line.opacity(0.55) : BVTheme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusXS, style: .continuous))
                    .contentTransition(.numericText())
            }

            Slider(
                value: Binding(
                    get: { sliderStates[control.name] ?? control.min },
                    set: { raw in
                        let snapped = Self.snapSlider(raw, control: control)
                        sliderStates[control.name] = snapped
                    }
                ),
                in: control.min...control.max,
                step: step
            ) { editing in
                if editing {
                    editingSliderName = control.name
                } else {
                    editingSliderName = nil
                    Task { await commitSlider(control) }
                }
            }
            .tint(inactive ? BVTheme.textTertiary : BVTheme.accent)
            .disabled(inactive)
            .animation(.easeInOut(duration: 0.45), value: value)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(BVTheme.card)
        .overlay(
            RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                .stroke(BVTheme.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
        .opacity(inactive ? 0.55 : 1)
        .allowsHitTesting(!inactive)
    }

    private static func snapSlider(_ raw: Double, control: DeviceControl) -> Double {
        let step = control.step
        guard step > 0 else {
            return min(control.max, max(control.min, raw))
        }
        let snapped = (raw - control.min) / step
        let rounded = snapped.rounded() * step + control.min
        return min(control.max, max(control.min, rounded))
    }

    // MARK: - Water level (dose Fill / Drain)

    private var currentLiters: Double {
        (waterLevelPercent / 100) * tankCapacityLiters
    }

    private var parsedTransferLiters: Double? {
        let normalized = transferAmountText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty, let value = Double(normalized), value > 0 else {
            return nil
        }
        return min(value, tankCapacityLiters)
    }

    private var atFull: Bool { waterLevelPercent >= 99.95 }
    private var atEmpty: Bool { waterLevelPercent <= 0.05 }

    private var fillDisabled: Bool {
        readOnly || levelBusy || atFull || parsedTransferLiters == nil
    }

    private var drainDisabled: Bool {
        readOnly || levelBusy || atEmpty || parsedTransferLiters == nil
    }

    private var waterLevelDoseSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Water level")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(BVTheme.textTertiary)
                Spacer(minLength: 8)
                Text(String(format: "%.1f%%", waterLevelPercent))
                    .font(.system(size: 18, weight: .bold).monospacedDigit())
                    .foregroundStyle(BVTheme.accent)
                    .contentTransition(.numericText())
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(BVTheme.text.opacity(0.08))
                    Capsule()
                        .fill(BVTheme.accent)
                        .frame(width: max(0, geo.size.width * CGFloat(waterLevelPercent / 100)))
                }
            }
            .frame(height: 10)

            Text(
                "\(formatLiters(currentLiters)) liter / \(formatLiters(tankCapacityLiters)) liter"
            )
            .font(.system(size: 13, weight: .semibold).monospacedDigit())
            .foregroundStyle(BVTheme.textSecondary)
            .contentTransition(.numericText())

            VStack(alignment: .leading, spacing: 6) {
                Text("AMOUNT")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(BVTheme.textTertiary)
                HStack(spacing: 0) {
                    TextField("0", text: Binding(
                        get: { transferAmountText },
                        set: { transferAmountText = clampTransferAmount($0) }
                    ))
                    .keyboardType(.decimalPad)
                    .font(.system(size: 15, weight: .semibold).monospacedDigit())
                    .foregroundStyle(BVTheme.text)
                    .focused($amountFieldFocused)
                    .disabled(readOnly || levelBusy)
                    Text("L")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(BVTheme.textTertiary)
                }
                .padding(.horizontal, 12)
                .frame(height: 40)
                .background(BVTheme.card)
                .overlay(
                    RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                        .stroke(
                            amountFieldFocused ? BVTheme.accentBorder : BVTheme.line,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
            }

            HStack(spacing: 8) {
                Button {
                    amountFieldFocused = false
                    startFillDose()
                } label: {
                    Text("Fill")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundStyle(.white)
                        .background(BVTheme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(fillDisabled)
                .opacity(fillDisabled ? 0.38 : 1)

                Button {
                    amountFieldFocused = false
                    startDrainDose()
                } label: {
                    Text("Drain")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundStyle(BVTheme.text)
                        .background(BVTheme.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                                .stroke(BVTheme.line, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(drainDisabled)
                .opacity(drainDisabled ? 0.38 : 1)
            }

            if let levelFeedback {
                Text(levelFeedback)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(levelFeedbackIsWarning ? BVTheme.danger : BVTheme.success)
            }
        }
        .padding(12)
        .background(BVTheme.fill)
        .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusPanel, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: BVTheme.radiusPanel, style: .continuous)
                .stroke(BVTheme.line, lineWidth: 1)
        )
        // Lift the whole card (not just the buttons) and leave sidePadding above the pad.
        .padding(.bottom, waterLevelKeyboardSpacer)
        .id(waterLevelActionsId)
    }

    private func formatLiters(_ value: Double) -> String {
        let rounded = Int(value.rounded())
        return rounded.formatted()
    }

    private func clampTransferAmount(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return raw }
        if trimmed.range(of: #"^\d+[.,]$"#, options: .regularExpression) != nil {
            return raw
        }
        let normalized = trimmed.replacingOccurrences(of: ",", with: ".")
        guard let value = Double(normalized), value.isFinite else { return raw }
        if value < 0 { return "0" }
        if value > tankCapacityLiters {
            return String(Int(tankCapacityLiters.rounded()))
        }
        return raw
    }

    private func startFillDose() {
        guard !levelBusy, let liters = parsedTransferLiters else { return }
        if atFull {
            showLevelFeedback("Tank is full. No more liquid can be added.", warning: true)
            return
        }
        let start = waterLevelPercent
        let deltaPercent = (liters / tankCapacityLiters) * 100
        let target = min(100, start + deltaPercent)
        if target <= start + 0.05 {
            showLevelFeedback("Tank is full. No more liquid can be added.", warning: true)
            return
        }
        runLevelTransfer(
            kind: .fill,
            startPercent: start,
            targetPercent: target,
            requestedLiters: liters
        )
    }

    private func startDrainDose() {
        guard !levelBusy, let liters = parsedTransferLiters else { return }
        if atEmpty {
            showLevelFeedback("Tank is empty. No more liquid can be drained.", warning: true)
            return
        }
        let start = waterLevelPercent
        let deltaPercent = (liters / tankCapacityLiters) * 100
        let target = max(0, start - deltaPercent)
        if target >= start - 0.05 {
            showLevelFeedback("Tank is empty. No more liquid can be drained.", warning: true)
            return
        }
        runLevelTransfer(
            kind: .drain,
            startPercent: start,
            targetPercent: target,
            requestedLiters: liters
        )
    }

    private enum LevelTransferKind { case fill, drain }

    private func runLevelTransfer(
        kind: LevelTransferKind,
        startPercent: Double,
        targetPercent: Double,
        requestedLiters: Double
    ) {
        levelTransferTask?.cancel()
        levelBusy = true
        levelFeedback = nil
        // levelBusy already blocks remote actuator echoes; keep ignore short.
        ignoreRemoteUntil = Date().addingTimeInterval(1.6)

        // Match web fill (~7.5 %/s) and drain (~14 %/s) rates.
        let ratePercentPerSec: Double = kind == .fill ? 7.5 : 14.0

        levelTransferTask = Task { @MainActor in
            var current = startPercent
            let stepDirection: Double = kind == .fill ? 1 : -1
            while !Task.isCancelled {
                let remaining = abs(targetPercent - current)
                if remaining <= 0.05 { break }
                let dt = 1.0 / 30.0
                let step = min(remaining, ratePercentPerSec * dt)
                current += step * stepDirection
                current = min(100, max(0, current))
                withAnimation(.linear(duration: dt)) {
                    waterLevelPercent = current
                }
                try? await Task.sleep(nanoseconds: UInt64(dt * 1_000_000_000))
            }

            if Task.isCancelled {
                levelBusy = false
                return
            }

            waterLevelPercent = targetPercent
            let actualLiters = abs(targetPercent - startPercent) / 100 * tankCapacityLiters
            let clipped = requestedLiters - actualLiters > 0.05
            await persistWaterLevel(percent: targetPercent)

            if Task.isCancelled {
                levelBusy = false
                return
            }

            if clipped {
                if kind == .fill {
                    showLevelFeedback(
                        "Only \(formatLiters(actualLiters)) liter could be added (you asked for \(formatLiters(requestedLiters)) liter). The tank is full.",
                        warning: true
                    )
                } else {
                    showLevelFeedback(
                        "Only \(formatLiters(actualLiters)) liter could be drained (you asked for \(formatLiters(requestedLiters)) liter). The tank is empty.",
                        warning: true
                    )
                }
            } else if kind == .fill {
                showLevelFeedback(
                    "Added \(formatLiters(actualLiters)) liter to the tank.",
                    warning: false
                )
            } else {
                showLevelFeedback(
                    "Removed \(formatLiters(actualLiters)) liter from the tank.",
                    warning: false
                )
            }

            levelBusy = false
            ignoreRemoteUntil = Date().addingTimeInterval(1.6)
        }
    }

    private func showLevelFeedback(_ message: String, warning: Bool) {
        levelFeedbackIsWarning = warning
        levelFeedback = message
    }

    private func persistWaterLevel(percent: Double) async {
        guard device.canOperate, let userId = session.userId else { return }
        let value = min(100, max(0, percent.rounded()))
        do {
            try await ActuatorService.setSlider(
                deviceId: device.id,
                name: waterLevelKey,
                state: value,
                userId: userId
            )
            try await SensorService.insertReading(
                deviceId: device.id,
                name: waterLevelKey,
                value: value,
                userId: userId
            )
        } catch {
            if !Self.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
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

        await withTaskGroup(of: Void.self) { group in
            group.addTask { @MainActor in
                for await _ in switchChanges {
                    guard !Task.isCancelled else { break }
                    // Apply remote switches unless a local toggle is in-flight.
                    if busyName == nil {
                        await loadStates(includeWaterLevel: false)
                    }
                }
            }
            group.addTask { @MainActor in
                for await _ in sliderChanges {
                    guard !Task.isCancelled else { break }
                    await refreshWaterLevel()
                    // Always take remote mixer/aerator setpoints from the website.
                    // Only skip while the user is dragging or dosing water locally.
                    if editingSliderName == nil && !levelBusy {
                        await loadStates(includeWaterLevel: false)
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

    /// Pull water level without waiting for the actuator ignore window.
    private func refreshWaterLevel() async {
        guard showsWaterLevelDose, !levelBusy else { return }
        do {
            if let loaded = try await ActuatorService.latestSliderIfPresent(
                deviceId: device.id,
                name: waterLevelKey
            ) {
                let next = min(100, max(0, loaded))
                if abs(next - waterLevelPercent) > 0.05 {
                    waterLevelPercent = next
                }
            }
        } catch {
            if !Self.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func loadStates(includeWaterLevel: Bool = true) async {
        let showSpinner = switchStates.isEmpty
        if showSpinner { loading = true }
        defer { loading = false }

        var nextSwitches: [String: Bool] = [:]
        var nextSliders: [String: Double] = [:]

        do {
            for control in controls {
                try Task.checkCancellation()
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
            // Skip no-op updates so toggles/backgrounds don't re-animate.
            if nextSwitches != switchStates {
                switchStates = nextSwitches
            }
            if nextSliders != sliderStates {
                withAnimation(.easeInOut(duration: 0.45)) {
                    sliderStates = nextSliders
                }
            }
            if includeWaterLevel {
                await refreshWaterLevel()
            }
            // Do not call enforceLevelGuards on every remote poll — that overwrites
            // website setpoints whenever this device briefly sees a stale low level.
            if errorMessage != nil {
                errorMessage = nil
            }
        } catch {
            if !Self.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return true }
        return false
    }

    /// Zero mixer/aerator when the liquid sits below the equipment threshold (matches web).
    private func enforceLevelGuards() async {
        guard device.canOperate, let userId = session.userId else { return }
        for control in sliderControls {
            guard isLevelTooLow(for: control) else { continue }
            let current = sliderStates[control.name] ?? 0
            guard current > 0 else { continue }
            withAnimation(.easeInOut(duration: 0.45)) {
                sliderStates[control.name] = 0
            }
            ignoreRemoteUntil = Date().addingTimeInterval(1.6)
            do {
                try await ActuatorService.setSlider(
                    deviceId: device.id,
                    name: control.name,
                    state: 0,
                    userId: userId
                )
            } catch {
                if !Self.isCancellation(error) {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func loadCharts() async {
        guard !chartSpecs.isEmpty else {
            if !chartPoints.isEmpty { chartPoints = [:] }
            return
        }

        var next: [String: [SensorReading]] = [:]
        do {
            for spec in chartSpecs {
                try Task.checkCancellation()
                let rows = try await SensorService.readings(deviceId: device.id, name: spec.name)
                next[spec.name] = SensorService.chartPoints(from: rows)
            }
            if next != chartPoints {
                chartPoints = next
            }
        } catch {
            if Self.isCancellation(error) { return }
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

        ignoreRemoteUntil = Date().addingTimeInterval(1.6)
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
            if !Self.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
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
        if isLevelTooLow(for: control) {
            withAnimation(.easeInOut(duration: 0.35)) {
                sliderStates[control.name] = 0
            }
            return
        }
        let value = Self.snapSlider(sliderStates[control.name] ?? 0, control: control)
        sliderStates[control.name] = value
        ignoreRemoteUntil = Date().addingTimeInterval(1.6)
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
            if !Self.isCancellation(error) {
                errorMessage = error.localizedDescription
            }
        }
    }
}
