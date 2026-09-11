import Charts
import SwiftUI

struct SensorChartCard: View {
    let label: String
    let points: [SensorReading]

    private var latest: Double? { points.last.map { round2($0.value) } }

    private var yDomain: ClosedRange<Double> {
        guard let minV = points.map(\.value).min(),
              let maxV = points.map(\.value).max()
        else { return 0...1 }
        let span = maxV - minV
        let pad = span == 0 ? max(abs(maxV) * 0.05, 0.5) : span * 0.18
        return round2(minV - pad)...round2(maxV + pad)
    }

    private var needsSeconds: Bool {
        let clocks = points.map { formatClock($0.createdAt, withSeconds: false) }
        return Set(clocks).count < clocks.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BVTheme.text)
                Spacer()
                if let latest {
                    Text(latest, format: .number.precision(.fractionLength(2)))
                        .font(.system(size: 20, weight: .semibold).monospacedDigit())
                        .foregroundStyle(BVTheme.accent)
                }
            }

            if points.isEmpty {
                Text("Waiting for readings…")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(BVTheme.textTertiary)
                    .frame(maxWidth: .infinity, minHeight: 160, alignment: .center)
            } else {
                Chart(points) { point in
                    AreaMark(
                        x: .value("Time", point.createdAt),
                        yStart: .value("Baseline", yDomain.lowerBound),
                        yEnd: .value("Value", point.value)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [BVTheme.accent.opacity(0.28), BVTheme.accent.opacity(0.02)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)

                    LineMark(
                        x: .value("Time", point.createdAt),
                        y: .value("Value", point.value)
                    )
                    .foregroundStyle(BVTheme.accent)
                    .lineStyle(StrokeStyle(lineWidth: 2.25))
                    .interpolationMethod(.catmullRom)
                    .symbol {
                        Circle()
                            .strokeBorder(BVTheme.accent, lineWidth: 1.5)
                            .background(Circle().fill(Color.white))
                            .frame(width: 8, height: 8)
                    }
                }
                .chartYScale(domain: yDomain)
                .chartXAxis {
                    AxisMarks(values: .automatic) { value in
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                Text(formatClock(date, withSeconds: needsSeconds))
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(BVTheme.textTertiary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 1))
                            .foregroundStyle(BVTheme.line)
                        AxisValueLabel {
                            if let number = value.as(Double.self) {
                                Text(round2(number), format: .number.precision(.fractionLength(2)))
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(BVTheme.textTertiary)
                            }
                        }
                    }
                }
                .frame(height: 160)
            }
        }
        .padding(16)
        .bvCard()
    }

    private func formatClock(_ date: Date, withSeconds: Bool) -> String {
        let cal = Calendar.current
        let h = cal.component(.hour, from: date)
        let m = cal.component(.minute, from: date)
        if withSeconds {
            let s = cal.component(.second, from: date)
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", h, m)
    }

    private func round2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}
