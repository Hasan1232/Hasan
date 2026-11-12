import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: UInt) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

extension Color {
    init(light: UInt, dark: UInt) {
        self.init(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

enum Theme {
    static let bg = Color(light: 0xF1F4EF, dark: 0x0F1712)
    static let surface = Color(light: 0xFFFFFF, dark: 0x17211B)
    static let surface2 = Color(light: 0xE8EEE6, dark: 0x1E2A23)
    static let ink = Color(light: 0x17231B, dark: 0xE5EEE7)
    static let line = Color(light: 0xD9E2D7, dark: 0x27352D)
    static let herb = Color(light: 0x2B6847, dark: 0x6DBB8D)
    static let onHerb = Color(light: 0xF3FAF5, dark: 0x0D1A12)
    static let hero = Color(light: 0x21533A, dark: 0x173A28)
    static let heroInk = Color(light: 0xEEF7F0, dark: 0xE9F5EC)
    static let heroMuted = Color(light: 0xA9C9B5, dark: 0x8FB69D)
    static let heroTrack = Color(light: 0x2F6A4C, dark: 0x235339)
    static let saffron = Color(light: 0xE59A2F, dark: 0xF0AA48)
    static let saffronInk = Color(light: 0x8A560C, dark: 0xF0AA48)
    static let saffronSoft = Color(light: 0xFBEED6, dark: 0x33281A)
    static let protein = Color(light: 0x3A6CB4, dark: 0x7EA7E6)
    static let carbs = Color(light: 0xD48A1E, dark: 0xF0AA48)
    static let fat = Color(light: 0xB24C46, dark: 0xE2847D)
    static let catStarch = Color(light: 0xC98516, dark: 0xB57A1C)
    static let catProtein = Color(light: 0xB24C46, dark: 0xA9524C)
    static let catVeg = Color(light: 0x3F8A4F, dark: 0x3F8A4F)
    static let catDairy = Color(light: 0x3A6CB4, dark: 0x4A78BC)
    static let catSweet = Color(light: 0x8A5AA8, dark: 0x8F62AD)
    static let catDrink = Color(light: 0x2A8585, dark: 0x2E8C8C)
}

private let wholeFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_US")
    f.numberStyle = .decimal
    f.maximumFractionDigits = 0
    return f
}()

private let oneDecimalFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_US")
    f.numberStyle = .decimal
    f.maximumFractionDigits = 1
    return f
}()

func fmt(_ v: Double) -> String { wholeFormatter.string(from: NSNumber(value: v.rounded())) ?? "0" }
func fmt1(_ v: Double) -> String { oneDecimalFormatter.string(from: NSNumber(value: v)) ?? "0" }

// MARK: - Shared components

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.line))
    }
}

extension View {
    func card() -> some View { modifier(CardStyle()) }
}

struct PrimaryButtonStyle: ButtonStyle {
    var filled = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(filled ? Theme.herb : Theme.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(filled ? Theme.onHerb : Theme.ink)
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

struct FoodAvatar: View {
    let name: String
    let category: FoodCategory
    var photo: Data? = nil

    var body: some View {
        Group {
            if let photo, let image = UIImage(data: photo) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                ZStack {
                    category.color
                    Text(String(name.trimmingCharacters(in: .whitespaces).prefix(1)))
                        .font(.headline)
                        .foregroundStyle(.white)
                }
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct ChipButton: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(selected ? Theme.ink : Theme.surface, in: Capsule())
                .foregroundStyle(selected ? Theme.bg : Theme.ink)
                .overlay(Capsule().stroke(selected ? Color.clear : Theme.line))
        }
        .buttonStyle(.plain)
    }
}

struct CategoryChips: View {
    @Binding var selection: FoodCategory?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ChipButton(title: "الكل", selected: selection == nil) { selection = nil }
                ForEach(FoodCategory.allCases) { c in
                    ChipButton(title: c.title, selected: selection == c) { selection = c }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

struct SlotChips: View {
    @Binding var slot: MealSlot

    var body: some View {
        HStack(spacing: 8) {
            ForEach(MealSlot.allCases) { s in
                ChipButton(title: s.title, selected: slot == s) { slot = s }
            }
        }
    }
}

struct FoodRow: View {
    let food: Food
    var showPlus = false

    var body: some View {
        HStack(spacing: 12) {
            FoodAvatar(name: food.name, category: food.category)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(food.name).font(.body.weight(.semibold)).lineLimit(1)
                    if !food.isBuiltin {
                        Text("من إضافتك")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 1)
                            .background(Theme.saffronSoft, in: Capsule())
                            .foregroundStyle(Theme.saffronInk)
                    }
                }
                Text(showPlus ? food.subtitle : "ب \(fmt1(food.protein)) · ك \(fmt1(food.carbs)) · د \(fmt1(food.fat)) غ")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if showPlus {
                Image(systemName: "plus")
                    .font(.body.bold())
                    .foregroundStyle(Theme.herb)
                    .frame(width: 34, height: 34)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(fmt(food.kcal)).font(.headline)
                    Text("/100غ").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.line))
        .contentShape(Rectangle())
    }
}

extension UIImage {
    func resized(maxSide: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxSide else { return self }
        let scale = maxSide / longest
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
