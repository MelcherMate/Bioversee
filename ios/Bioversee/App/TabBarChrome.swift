import SwiftUI
import UIKit

/// Drives the floating tab bar collapse while scrolling.
@MainActor
final class TabBarChrome: ObservableObject {
    static let shared = TabBarChrome()

    @Published private(set) var isCollapsed = false

    private var lastOffset: CGFloat = 0
    private var hasLastOffset = false

    func reset() {
        withAnimation(.easeInOut(duration: 0.28)) {
            isCollapsed = false
        }
        lastOffset = 0
        hasLastOffset = false
    }

    func setCollapsed(_ collapsed: Bool) {
        guard AppearanceStore.shared.autoHideTabBar else {
            if isCollapsed { isCollapsed = false }
            return
        }
        guard isCollapsed != collapsed else { return }
        withAnimation(.easeInOut(duration: 0.28)) {
            isCollapsed = collapsed
        }
    }

    func handleOffset(_ offsetY: CGFloat) {
        guard AppearanceStore.shared.autoHideTabBar else {
            if isCollapsed { isCollapsed = false }
            return
        }

        defer {
            lastOffset = offsetY
            hasLastOffset = true
        }

        // Always reveal near the top.
        if offsetY <= 16 {
            setCollapsed(false)
            return
        }

        guard hasLastOffset else { return }
        let delta = offsetY - lastOffset

        // Ignore tiny jitter from rubber-banding / layout passes.
        guard abs(delta) >= 4 else { return }

        if delta > 0 {
            setCollapsed(true)
        } else {
            setCollapsed(false)
        }
    }

    /// Finger-drag fallback (works even when UIScrollView discovery fails).
    func handleDragTranslation(_ translationY: CGFloat) {
        guard AppearanceStore.shared.autoHideTabBar else {
            if isCollapsed { isCollapsed = false }
            return
        }
        if translationY < -28 {
            setCollapsed(true)
        } else if translationY > 28 {
            setCollapsed(false)
        }
    }
}

/// Discovers the nearest UIScrollView (List / ScrollView) and watches contentOffset.
struct TabBarScrollObserver: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        view.onMovedToWindow = { [weak coordinator = context.coordinator] probe in
            coordinator?.scheduleAttach(from: probe)
        }
        return view
    }

    func updateUIView(_ uiView: ProbeView, context: Context) {
        context.coordinator.scheduleAttach(from: uiView)
    }

    final class Coordinator {
        private var observation: NSKeyValueObservation?
        private weak var scrollView: UIScrollView?
        private var retryWorkItem: DispatchWorkItem?
        private var retryCount = 0

        deinit {
            observation?.invalidate()
            retryWorkItem?.cancel()
        }

        func scheduleAttach(from view: UIView) {
            retryWorkItem?.cancel()
            let work = DispatchWorkItem { [weak self, weak view] in
                guard let self, let view else { return }
                self.attach(from: view)
            }
            retryWorkItem = work
            DispatchQueue.main.async(execute: work)
        }

        private func attach(from view: UIView) {
            guard let found = Self.findScrollView(near: view) else {
                guard retryCount < 24 else { return }
                retryCount += 1
                let work = DispatchWorkItem { [weak self, weak view] in
                    guard let self, let view else { return }
                    self.attach(from: view)
                }
                retryWorkItem = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: work)
                return
            }

            retryCount = 0
            guard found !== scrollView else { return }

            observation?.invalidate()
            scrollView = found
            observation = found.observe(\.contentOffset, options: [.new]) { scroll, _ in
                let y = scroll.contentOffset.y
                DispatchQueue.main.async {
                    TabBarChrome.shared.handleOffset(y)
                }
            }
        }

        /// SwiftUI often places representable backgrounds as *siblings* of the
        /// UIScrollView, so we search each ancestor's subtree (preferring the
        /// scroller under the probe point).
        private static func findScrollView(near view: UIView) -> UIScrollView? {
            let probePoint = view.convert(
                CGPoint(x: view.bounds.midX, y: max(view.bounds.midY, 1)),
                to: nil
            )

            var node: UIView? = view
            while let current = node {
                if let scroll = current as? UIScrollView, isUsable(scroll) {
                    return scroll
                }
                if let parent = current.superview,
                   let scroll = bestScrollView(in: parent, preferring: probePoint)
                {
                    return scroll
                }
                node = current.superview
            }
            return nil
        }

        private static func bestScrollView(in root: UIView, preferring point: CGPoint) -> UIScrollView? {
            var containing: UIScrollView?
            var containingArea: CGFloat = 0
            var fallback: UIScrollView?
            var fallbackArea: CGFloat = 0

            func visit(_ view: UIView) {
                if let scroll = view as? UIScrollView, isUsable(scroll) {
                    let area = scroll.bounds.width * scroll.bounds.height
                    let frameInWindow = scroll.convert(scroll.bounds, to: nil)
                    if frameInWindow.contains(point), area > containingArea {
                        containingArea = area
                        containing = scroll
                    } else if area > fallbackArea {
                        fallbackArea = area
                        fallback = scroll
                    }
                }
                for child in view.subviews {
                    visit(child)
                }
            }

            visit(root)
            return containing ?? fallback
        }

        private static func isUsable(_ scroll: UIScrollView) -> Bool {
            guard scroll.isScrollEnabled else { return false }
            // Skip tiny nested scrollers / horizontal strips.
            guard scroll.bounds.height > 120 else { return false }
            return true
        }
    }

    final class ProbeView: UIView {
        var onMovedToWindow: ((UIView) -> Void)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil {
                onMovedToWindow?(self)
            }
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            if window != nil {
                onMovedToWindow?(self)
            }
        }
    }
}

extension View {
    /// Observe vertical scrolling so the floating tab bar can auto-hide.
    func trackTabBarScroll() -> some View {
        background {
            TabBarScrollObserver()
                .allowsHitTesting(false)
        }
    }
}
