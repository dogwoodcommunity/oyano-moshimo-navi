import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets")

struct Brand {
    static let ink = NSColor(calibratedRed: 0.126, green: 0.157, blue: 0.133, alpha: 1)
    static let paper = NSColor(calibratedRed: 0.953, green: 0.933, blue: 0.878, alpha: 1)
    static let surface = NSColor(calibratedRed: 1.0, green: 0.992, blue: 0.969, alpha: 1)
    static let green = NSColor(calibratedRed: 0.157, green: 0.388, blue: 0.282, alpha: 1)
    static let greenDark = NSColor(calibratedRed: 0.082, green: 0.231, blue: 0.169, alpha: 1)
    static let leaf = NSColor(calibratedRed: 0.498, green: 0.596, blue: 0.341, alpha: 1)
    static let gold = NSColor(calibratedRed: 0.608, green: 0.427, blue: 0.169, alpha: 1)
}

func savePng(size: CGSize, url: URL, draw: (CGRect) -> Void) {
    guard
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int(size.width),
            pixelsHigh: Int(size.height),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ),
        let context = NSGraphicsContext(bitmapImageRep: bitmap)
    else {
        fatalError("Could not render \(url.path)")
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    draw(CGRect(origin: .zero, size: size))
    NSGraphicsContext.restoreGraphicsState()

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode \(url.path)")
    }

    try! png.write(to: url)
}

func fillRounded(_ rect: CGRect, radius: CGFloat, color: NSColor) {
    color.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func strokeRounded(_ rect: CGRect, radius: CGFloat, color: NSColor, width: CGFloat) {
    color.setStroke()
    let path = NSBezierPath(roundedRect: rect.insetBy(dx: width / 2, dy: width / 2), xRadius: radius, yRadius: radius)
    path.lineWidth = width
    path.stroke()
}

func drawLeaf(center: CGPoint, scale: CGFloat) {
    let path = NSBezierPath()
    path.move(to: CGPoint(x: center.x - 18 * scale, y: center.y - 4 * scale))
    path.curve(
        to: CGPoint(x: center.x + 24 * scale, y: center.y + 24 * scale),
        controlPoint1: CGPoint(x: center.x - 12 * scale, y: center.y + 32 * scale),
        controlPoint2: CGPoint(x: center.x + 16 * scale, y: center.y + 38 * scale)
    )
    path.curve(
        to: CGPoint(x: center.x - 18 * scale, y: center.y - 4 * scale),
        controlPoint1: CGPoint(x: center.x + 6 * scale, y: center.y + 2 * scale),
        controlPoint2: CGPoint(x: center.x - 8 * scale, y: center.y - 12 * scale)
    )
    Brand.leaf.setFill()
    path.fill()
}

func drawMascot(center: CGPoint, scale: CGFloat, shadow: Bool = true) {
    if shadow {
        NSColor(calibratedWhite: 0, alpha: 0.12).setFill()
        NSBezierPath(ovalIn: CGRect(x: center.x - 116 * scale, y: center.y - 154 * scale, width: 232 * scale, height: 42 * scale)).fill()
    }

    drawLeaf(center: CGPoint(x: center.x + 76 * scale, y: center.y + 126 * scale), scale: scale)

    let book = CGRect(x: center.x - 92 * scale, y: center.y - 118 * scale, width: 184 * scale, height: 226 * scale)
    fillRounded(book, radius: 48 * scale, color: Brand.green)
    strokeRounded(book, radius: 48 * scale, color: Brand.greenDark, width: 9 * scale)

    fillRounded(CGRect(x: book.minX + 30 * scale, y: book.minY + 10 * scale, width: 22 * scale, height: book.height - 20 * scale), radius: 11 * scale, color: NSColor.white.withAlphaComponent(0.20))

    Brand.surface.setFill()
    NSBezierPath(ovalIn: CGRect(x: center.x - 45 * scale, y: center.y + 36 * scale, width: 20 * scale, height: 20 * scale)).fill()
    NSBezierPath(ovalIn: CGRect(x: center.x + 25 * scale, y: center.y + 36 * scale, width: 20 * scale, height: 20 * scale)).fill()

    Brand.surface.setStroke()
    let smile = NSBezierPath()
    smile.move(to: CGPoint(x: center.x - 31 * scale, y: center.y + 4 * scale))
    smile.curve(
        to: CGPoint(x: center.x + 31 * scale, y: center.y + 4 * scale),
        controlPoint1: CGPoint(x: center.x - 17 * scale, y: center.y - 22 * scale),
        controlPoint2: CGPoint(x: center.x + 17 * scale, y: center.y - 22 * scale)
    )
    smile.lineWidth = 9 * scale
    smile.lineCapStyle = .round
    smile.stroke()

    let check = NSBezierPath()
    check.move(to: CGPoint(x: center.x - 34 * scale, y: center.y - 56 * scale))
    check.line(to: CGPoint(x: center.x - 8 * scale, y: center.y - 82 * scale))
    check.line(to: CGPoint(x: center.x + 44 * scale, y: center.y - 26 * scale))
    check.lineWidth = 11 * scale
    check.lineCapStyle = .round
    check.lineJoinStyle = .round
    Brand.surface.setStroke()
    check.stroke()
}

func drawIcon(size: CGFloat, url: URL) {
    savePng(size: CGSize(width: size, height: size), url: url) { rect in
        Brand.paper.setFill()
        rect.fill()
        fillRounded(rect.insetBy(dx: size * 0.075, dy: size * 0.075), radius: size * 0.19, color: Brand.surface)
        drawMascot(center: CGPoint(x: size / 2, y: size / 2 + size * 0.005), scale: size / 420, shadow: true)
        Brand.gold.setFill()
        NSBezierPath(ovalIn: CGRect(x: size * 0.165, y: size * 0.165, width: size * 0.078, height: size * 0.078)).fill()
    }
}

func drawSplash(url: URL) {
    let width: CGFloat = 1242
    let height: CGFloat = 2436
    savePng(size: CGSize(width: width, height: height), url: url) { rect in
        Brand.paper.setFill()
        rect.fill()
        fillRounded(CGRect(x: 156, y: 604, width: 930, height: 820), radius: 56, color: Brand.surface)
        drawMascot(center: CGPoint(x: width / 2, y: 1012), scale: 1.48, shadow: true)

        let title = "親のもしもナビ" as NSString
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 74, weight: .heavy),
            .foregroundColor: Brand.greenDark
        ]
        title.draw(at: CGPoint(x: (width - title.size(withAttributes: titleAttrs).width) / 2, y: 1420), withAttributes: titleAttrs)

        let sub = "家族の保管庫・通知係" as NSString
        let subAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 40, weight: .bold),
            .foregroundColor: Brand.ink.withAlphaComponent(0.68)
        ]
        sub.draw(at: CGPoint(x: (width - sub.size(withAttributes: subAttrs).width) / 2, y: 1514), withAttributes: subAttrs)
    }
}

func drawNotificationIcon(url: URL) {
    savePng(size: CGSize(width: 96, height: 96), url: url) { rect in
        NSColor.clear.setFill()
        rect.fill()
        Brand.green.setFill()
        NSBezierPath(roundedRect: CGRect(x: 24, y: 18, width: 48, height: 60), xRadius: 13, yRadius: 13).fill()
        Brand.surface.setFill()
        NSBezierPath(ovalIn: CGRect(x: 37, y: 45, width: 7, height: 7)).fill()
        NSBezierPath(ovalIn: CGRect(x: 52, y: 45, width: 7, height: 7)).fill()
        Brand.surface.setStroke()
        let check = NSBezierPath()
        check.move(to: CGPoint(x: 37, y: 33))
        check.line(to: CGPoint(x: 46, y: 24))
        check.line(to: CGPoint(x: 61, y: 40))
        check.lineWidth = 6
        check.lineCapStyle = .round
        check.lineJoinStyle = .round
        check.stroke()
    }
}

drawIcon(size: 1024, url: assets.appendingPathComponent("icon.png"))
drawIcon(size: 1024, url: assets.appendingPathComponent("adaptive-icon.png"))
drawSplash(url: assets.appendingPathComponent("splash.png"))
drawNotificationIcon(url: assets.appendingPathComponent("notification-icon.png"))
print("Rendered mobile brand assets")
