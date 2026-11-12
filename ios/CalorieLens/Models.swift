import Foundation
import SwiftData
import SwiftUI

struct Nutrition {
    var kcal: Double = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fat: Double = 0

    static func + (a: Nutrition, b: Nutrition) -> Nutrition {
        Nutrition(kcal: a.kcal + b.kcal, protein: a.protein + b.protein,
                  carbs: a.carbs + b.carbs, fat: a.fat + b.fat)
    }
}

enum FoodCategory: String, CaseIterable, Identifiable, Codable {
    case starch, protein, veg, dairy, sweet, drink

    var id: String { rawValue }

    var title: String {
        switch self {
        case .starch: return "نشويات وخبز"
        case .protein: return "لحوم وبروتين"
        case .veg: return "خضار وفواكه"
        case .dairy: return "ألبان وبيض"
        case .sweet: return "دهون وحلويات"
        case .drink: return "مشروبات"
        }
    }

    var color: Color {
        switch self {
        case .starch: return Theme.catStarch
        case .protein: return Theme.catProtein
        case .veg: return Theme.catVeg
        case .dairy: return Theme.catDairy
        case .sweet: return Theme.catSweet
        case .drink: return Theme.catDrink
        }
    }
}

enum MealSlot: String, CaseIterable, Identifiable {
    case breakfast, lunch, dinner, snack

    var id: String { rawValue }

    var title: String {
        switch self {
        case .breakfast: return "فطور"
        case .lunch: return "غداء"
        case .dinner: return "عشاء"
        case .snack: return "سناك"
        }
    }

    static var now: MealSlot {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 11 { return .breakfast }
        if hour < 16 { return .lunch }
        if hour < 21 { return .dinner }
        return .snack
    }
}

/// A food in the user's list. Nutrition values are per 100 g.
@Model
final class Food {
    var name: String
    var categoryRaw: String
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var unitName: String
    var unitGrams: Double
    var isBuiltin: Bool
    var createdAt: Date

    init(name: String, category: FoodCategory, kcal: Double, protein: Double, carbs: Double, fat: Double,
         unitName: String = "", unitGrams: Double = 0, isBuiltin: Bool = false, createdAt: Date = Date()) {
        self.name = name
        self.categoryRaw = category.rawValue
        self.kcal = kcal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.unitName = unitName
        self.unitGrams = unitGrams
        self.isBuiltin = isBuiltin
        self.createdAt = createdAt
    }

    var category: FoodCategory { FoodCategory(rawValue: categoryRaw) ?? .starch }
    var hasUnit: Bool { !unitName.isEmpty && unitGrams > 0 }

    func nutrition(grams: Double) -> Nutrition {
        Nutrition(kcal: kcal * grams / 100, protein: protein * grams / 100,
                  carbs: carbs * grams / 100, fat: fat * grams / 100)
    }

    var subtitle: String {
        var s = "\(fmt(kcal)) سعرة/100غ"
        if hasUnit { s += " · \(unitName) = \(fmt(kcal * unitGrams / 100))" }
        return s
    }
}

/// One logged meal.
@Model
final class MealEntry {
    var date: Date
    var slotRaw: String
    var name: String
    var amountText: String
    var grams: Double
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var categoryRaw: String
    var fromCamera: Bool
    @Attribute(.externalStorage) var photo: Data?

    init(name: String, slot: MealSlot, amountText: String, grams: Double, nutrition: Nutrition,
         category: FoodCategory, fromCamera: Bool, photo: Data? = nil, date: Date = Date()) {
        self.date = date
        self.slotRaw = slot.rawValue
        self.name = name
        self.amountText = amountText
        self.grams = grams
        self.kcal = nutrition.kcal
        self.protein = nutrition.protein
        self.carbs = nutrition.carbs
        self.fat = nutrition.fat
        self.categoryRaw = category.rawValue
        self.fromCamera = fromCamera
        self.photo = photo
    }

    var slot: MealSlot { MealSlot(rawValue: slotRaw) ?? .snack }
    var category: FoodCategory { FoodCategory(rawValue: categoryRaw) ?? .starch }
    var nutrition: Nutrition { Nutrition(kcal: kcal, protein: protein, carbs: carbs, fat: fat) }
}

/// Reference values per 100 g (USDA and common Arabic food tables, approximate).
enum BuiltinFoods {
    static let list: [(String, FoodCategory, Double, Double, Double, Double, String, Double)] = [
        ("رز أبيض مطبوخ", .starch, 130, 2.7, 28, 0.3, "كوب", 158),
        ("رز كبسة/بسمتي بالزيت", .starch, 165, 3.2, 30, 3.6, "صحن", 250),
        ("خبز عربي", .starch, 275, 9, 55, 1.2, "رغيف", 60),
        ("خبز صامولي أبيض", .starch, 265, 9, 49, 3.2, "حبة", 50),
        ("شوفان جاف", .starch, 389, 17, 66, 7, "ملعقة كبيرة", 10),
        ("معكرونة مطبوخة", .starch, 158, 5.8, 31, 0.9, "كوب", 140),
        ("بطاطس مقلية", .starch, 312, 3.4, 41, 15, "حصة وسط", 117),
        ("بطاطس مسلوقة", .starch, 87, 1.9, 20, 0.1, "حبة", 150),
        ("صدر دجاج مشوي", .protein, 165, 31, 0, 3.6, "قطعة", 120),
        ("دجاج مشوي بالجلد", .protein, 239, 27, 0, 14, "ربع دجاجة", 200),
        ("لحم بقر مفروم مطبوخ", .protein, 250, 26, 0, 15, "", 0),
        ("لحم غنم مطبوخ", .protein, 294, 25, 0, 21, "", 0),
        ("سمك أبيض مشوي", .protein, 118, 25, 0, 1.3, "شريحة", 150),
        ("سلمون مطبوخ", .protein, 206, 22, 0, 12, "شريحة", 150),
        ("تونة معلبة بالماء", .protein, 116, 26, 0, 0.8, "علبة", 120),
        ("فول مدمس", .protein, 110, 7.6, 19.7, 0.4, "صحن", 200),
        ("حمص بطحينة", .protein, 166, 7.9, 14.3, 9.6, "ملعقة كبيرة", 15),
        ("فلافل", .protein, 333, 13.3, 31.8, 17.8, "حبة", 17),
        ("بيض مسلوق", .dairy, 155, 13, 1.1, 11, "حبة", 50),
        ("لبن زبادي كامل الدسم", .dairy, 61, 3.5, 4.7, 3.3, "علبة", 170),
        ("حليب كامل الدسم", .dairy, 61, 3.2, 4.8, 3.3, "كوب", 244),
        ("جبنة بيضاء", .dairy, 264, 14, 4, 21, "شريحة", 30),
        ("لبنة", .dairy, 155, 6, 4, 13, "ملعقة كبيرة", 20),
        ("تمر", .veg, 282, 2.5, 75, 0.4, "حبة", 10),
        ("موز", .veg, 89, 1.1, 23, 0.3, "حبة", 118),
        ("تفاح", .veg, 52, 0.3, 14, 0.2, "حبة", 180),
        ("طماطم", .veg, 18, 0.9, 3.9, 0.2, "حبة", 120),
        ("خيار", .veg, 15, 0.7, 3.6, 0.1, "حبة", 100),
        ("سلطة خضراء بدون صوص", .veg, 20, 1.2, 3.5, 0.2, "صحن", 150),
        ("زيت زيتون", .sweet, 884, 0, 0, 100, "ملعقة كبيرة", 13.5),
        ("مكسرات مشكلة", .sweet, 607, 20, 21, 54, "حفنة", 30),
        ("شوكولاتة بالحليب", .sweet, 535, 7.6, 59, 30, "لوح صغير", 45),
        ("شاي بملعقة سكر", .drink, 11, 0, 2.8, 0, "كوب", 150),
        ("قهوة عربية", .drink, 2, 0.1, 0.3, 0, "فنجان", 50),
        ("عصير برتقال طبيعي", .drink, 45, 0.7, 10.4, 0.2, "كوب", 248)
    ]

    static func seed(into context: ModelContext) {
        let base = Date(timeIntervalSince1970: 0)
        for (i, f) in list.enumerated() {
            context.insert(Food(name: f.0, category: f.1, kcal: f.2, protein: f.3, carbs: f.4, fat: f.5,
                                unitName: f.6, unitGrams: f.7, isBuiltin: true,
                                createdAt: base.addingTimeInterval(Double(i))))
        }
        try? context.save()
    }
}

/// Custom foods first (newest on top), then the built-in list in its original order.
func sortedFoods(_ foods: [Food]) -> [Food] {
    let custom = foods.filter { !$0.isBuiltin }.sorted { $0.createdAt > $1.createdAt }
    let builtin = foods.filter { $0.isBuiltin }.sorted { $0.createdAt < $1.createdAt }
    return custom + builtin
}
