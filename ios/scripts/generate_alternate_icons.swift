import AppKit
import Foundation

let root = URL(fileURLWithPath: CommandLine.arguments[1])
let sourceURL = root.appendingPathComponent("Bioversee/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
guard let source = NSImage(contentsOf: sourceURL) else {
    fputs("Failed to load AppIcon.png\n", stderr)
    exit(1)
}

struct Spec {
    let folder: String
    let filename: String
    let hex: String
}

let specs: [Spec] = [
    .init(folder: "AppIconYellow.appiconset", filename: "AppIconYellow.png", hex: "#ffe15d"),
    .init(folder: "AppIconRed.appiconset", filename: "AppIconRed.png", hex: "#ff6b6b"),
    .init(folder: "AppIconBlue.appiconset", filename: "AppIconBlue.png", hex: "#5b9fff"),
]

func color(hex: String) -> NSColor {
    var raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: raw).scanHexInt64(&value)
    let r = CGFloat((value >> 16) & 0xff) / 255
    let g = CGFloat((value >> 8) & 0xff) / 255
    let b = CGFloat(value & 0xff) / 255
    return NSColor(srgbRed: r, green: g, blue: b, alpha: 1)
}

func render(background: NSColor) -> NSImage {
    let size = NSSize(width: 1024, height: 1024)
    let image = NSImage(size: size)
    image.lockFocus()
    background.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()

    // Draw source logo centered, slightly inset so mark stays clear on colored field.
    let inset: CGFloat = 96
    let dest = NSRect(x: inset, y: inset, width: size.width - inset * 2, height: size.height - inset * 2)
    // Prefer drawing only non-background pixels: use source as-is (may already include green bg).
    // Extract roughly by compositing source over new bg with source-over.
    source.draw(in: dest, from: .zero, operation: .sourceOver, fraction: 1.0, respectFlipped: true, hints: [
        .interpolation: NSImageInterpolation.high
    ])
    image.unlockFocus()
    return image
}

// Better approach: take center mark by using destination-out of near-green? 
// Simpler: sample if source has green bg — replace near-teal pixels with new color, keep logo.

func recolorBackground(of source: NSImage, to hex: String) -> NSImage {
    let size = NSSize(width: 1024, height: 1024)
    guard let tiff = source.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let cg = rep.cgImage else {
        return render(background: color(hex: hex))
    }

    let width = cg.width
    let height = cg.height
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    var data = [UInt8](repeating: 0, count: height * bytesPerRow)
    guard let ctx = CGContext(
        data: &data,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return render(background: color(hex: hex))
    }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))

    let target = color(hex: hex)
    var tr: CGFloat = 0, tg: CGFloat = 0, tb: CGFloat = 0, ta: CGFloat = 0
    target.getRed(&tr, green: &tg, blue: &tb, alpha: &ta)
    let nr = UInt8(tr * 255), ng = UInt8(tg * 255), nb = UInt8(tb * 255)

    // Default Bioversee green ~ #0d9488
    let gr = 13, gg = 148, gb = 136

    for i in stride(from: 0, to: data.count, by: 4) {
        let r = Int(data[i])
        let g = Int(data[i + 1])
        let b = Int(data[i + 2])
        let a = data[i + 3]
        guard a > 10 else { continue }
        let dist = (r - gr) * (r - gr) + (g - gg) * (g - gg) + (b - gb) * (b - gb)
        // Also catch near-white/light green fills and flat backgrounds
        let isTealish = dist < 9000 || (g > r + 30 && g > b && g > 80 && r < 120)
        let isNearUniformGreen = abs(r - gr) < 40 && abs(g - gg) < 40 && abs(b - gb) < 40
        if isNearUniformGreen || (isTealish && dist < 16000) {
            data[i] = nr
            data[i + 1] = ng
            data[i + 2] = nb
        }
    }

    guard let outCG = ctx.makeImage() else {
        return render(background: color(hex: hex))
    }
    let out = NSImage(cgImage: outCG, size: size)
    return out
}

func writePNG(_ image: NSImage, to url: URL) {
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        fputs("PNG encode failed\n", stderr)
        exit(1)
    }
    try! png.write(to: url)
}

let assets = root.appendingPathComponent("Bioversee/Resources/Assets.xcassets")

for spec in specs {
    let dir = assets.appendingPathComponent(spec.folder)
    try! FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let image = recolorBackground(of: source, to: spec.hex)
    writePNG(image, to: dir.appendingPathComponent(spec.filename))
    let contents = """
    {
      "images" : [
        {
          "filename" : "\(spec.filename)",
          "idiom" : "universal",
          "platform" : "ios",
          "size" : "1024x1024"
        }
      ],
      "info" : {
        "author" : "xcode",
        "version" : 1
      }
    }
    """
    try! contents.write(to: dir.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)
    print("Wrote \(spec.folder)")
}
