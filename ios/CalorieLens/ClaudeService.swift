import Foundation
import Security
import UIKit

// MARK: - API key storage (iOS Keychain)

enum Keychain {
    private static let service = "CalorieLens"
    private static let account = "anthropic-api-key"

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func save(_ value: String) {
        SecItemDelete(baseQuery as CFDictionary)
        var add = baseQuery
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func load() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data,
              let key = String(data: data, encoding: .utf8),
              !key.isEmpty else { return nil }
        return key
    }

    static func delete() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}

// MARK: - Response types

struct ScanItem: Codable, Identifiable {
    var id = UUID()
    var name: String
    var grams: Double
    var kcal100: Double
    var p100: Double
    var c100: Double
    var f100: Double
    var confidence: String

    enum CodingKeys: String, CodingKey {
        case name, grams, kcal100, p100, c100, f100, confidence
    }

    var nutrition: Nutrition {
        Nutrition(kcal: kcal100 * grams / 100, protein: p100 * grams / 100,
                  carbs: c100 * grams / 100, fat: f100 * grams / 100)
    }

    /// Share of uncertainty used for the expected calorie range.
    var errorShare: Double {
        switch confidence {
        case "high": return 0.10
        case "low": return 0.35
        default: return 0.20
        }
    }
}

struct ScanResult: Codable {
    var dish: String
    var items: [ScanItem]
    var notes: String
}

struct FoodLookup: Codable {
    var category: String
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var unitName: String
    var unitGrams: Double
    var note: String
}

enum ClaudeError: LocalizedError {
    case missingKey, invalidKey, rateLimited, overloaded, refusal, truncated, network, badImage
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingKey: return "أضف مفتاح Anthropic API من الإعدادات أولاً."
        case .invalidKey: return "مفتاح API غير صحيح أو انتهت صلاحيته. راجعه في الإعدادات."
        case .rateLimited: return "طلبات كثيرة في وقت قصير، أو الرصيد في حسابك انتهى. انتظر قليلاً وراجع رصيدك."
        case .overloaded: return "الخدمة مشغولة الآن. حاول بعد دقيقة."
        case .refusal: return "تعذّر تحليل هذا الطلب. جرّب صورة أخرى."
        case .truncated: return "الرد كان طويلاً وانقطع. حاول مرة أخرى."
        case .network: return "تعذّر الاتصال بالإنترنت. تأكد من الاتصال وحاول مرة أخرى."
        case .badImage: return "تعذّر تجهيز الصورة. جرّب صورة أخرى."
        case .server(let message): return message
        }
    }
}

// MARK: - Claude Messages API

struct ClaudeService {
    static let model = "claude-opus-5-5"
    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!

    func analyze(image: UIImage, note: String) async throws -> ScanResult {
        guard let jpeg = image.resized(maxSide: 1400).jpegData(compressionQuality: 0.8) else {
            throw ClaudeError.badImage
        }
        let content: [[String: Any]] = [
            ["type": "image",
             "source": ["type": "base64", "media_type": "image/jpeg", "data": jpeg.base64EncodedString()]],
            ["type": "text", "text": Prompts.scan(note: note)]
        ]
        return try await send(content: content, schema: Schemas.scan, effort: "high")
    }

    func lookup(name: String) async throws -> FoodLookup {
        let content: [[String: Any]] = [["type": "text", "text": Prompts.lookup(name: name)]]
        return try await send(content: content, schema: Schemas.lookup, effort: "low")
    }

    private func send<T: Decodable>(content: [[String: Any]], schema: [String: Any], effort: String) async throws -> T {
        guard let key = Keychain.load() else { throw ClaudeError.missingKey }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 180
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        request.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")

        let body: [String: Any] = [
            "model": Self.model,
            "max_tokens": 16000,
            "fallbacks": "default",
            "output_config": [
                "effort": effort,
                "format": ["type": "json_schema", "schema": schema]
            ],
            "messages": [["role": "user", "content": content]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw ClaudeError.network
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]

        guard status == 200 else {
            switch status {
            case 401, 403: throw ClaudeError.invalidKey
            case 429: throw ClaudeError.rateLimited
            case 500...599: throw ClaudeError.overloaded
            default:
                let message = (json["error"] as? [String: Any])?["message"] as? String ?? "خطأ \(status)"
                throw ClaudeError.server(message)
            }
        }

        switch json["stop_reason"] as? String {
        case "refusal": throw ClaudeError.refusal
        case "max_tokens": throw ClaudeError.truncated
        default: break
        }

        let blocks = json["content"] as? [[String: Any]] ?? []
        let text = blocks
            .filter { ($0["type"] as? String) == "text" }
            .compactMap { $0["text"] as? String }
            .joined()
        guard let textData = text.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(T.self, from: textData) else {
            throw ClaudeError.server("وصل رد غير متوقع. حاول مرة أخرى.")
        }
        return decoded
    }
}

enum Prompts {
    static func scan(note: String) -> String {
        var text = """
        أنت أخصائي تغذية خبير في تقدير الحصص من الصور، وتعرف المطبخ العربي والخليجي والشامي والعالمي.
        حلّل صورة الوجبة وقدّر قيمتها الغذائية بأقصى دقة ممكنة:
        1. حدّد كل مكوّن ظاهر على حدة.
        2. قدّر الوزن بالغرام لكل مكوّن مستعيناً بمراجع الحجم في الصورة (طبق قياسي قطره نحو 26 سم، ملعقة، شوكة، يد، كوب).
        3. استخدم قيم USDA أو جداول التغذية المعتمدة لكل 100 غرام بحالة الطعام الظاهرة (مطبوخ، مقلي، نيء).
        4. احسب الزيوت والسمن والصوصات المخفية المعتادة لطريقة الطبخ.
        5. حدد الثقة لكل مكوّن: high أو medium أو low.
        إذا لم تكن الصورة طعاماً فأرجع items فارغة واشرح السبب في notes.
        اكتب أسماء المكوّنات واسم الوجبة والملاحظات بالعربية. في notes اذكر أهم مصدر لعدم اليقين ونصيحة قصيرة لزيادة الدقة.
        القيم kcal100 وp100 وc100 وf100 هي السعرات والبروتين والكربوهيدرات والدهون لكل 100 غرام.
        """
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            text += "\nمعلومات من المستخدم، قدّمها على تقديرك البصري: \(trimmed)"
        }
        return text
    }

    static func lookup(name: String) -> String {
        """
        أنت أخصائي تغذية. أعطني القيم الغذائية لكل 100 غرام من: "\(name)" كما يؤكل عادة (مطبوخاً إن كان يُطبخ، وبالطريقة الشائعة في المطبخ العربي إن كان طبقاً عربياً). اعتمد على USDA أو جداول التغذية المعتمدة.
        category واحد من: starch (نشويات وخبز)، protein (لحوم وبروتين)، veg (خضار وفواكه)، dairy (ألبان وبيض)، sweet (دهون وحلويات)، drink (مشروبات).
        unitName اسم حصة شائعة بالعربية مثل حبة أو كوب أو ملعقة كبيرة أو صحن، وunitGrams وزنها بالغرام.
        note جملة قصيرة بالعربية عن الافتراض الذي اعتمدته.
        """
    }
}

enum Schemas {
    private static let number: [String: Any] = ["type": "number"]
    private static let string: [String: Any] = ["type": "string"]

    static let scan: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["dish", "items", "notes"],
        "properties": [
            "dish": string,
            "notes": string,
            "items": [
                "type": "array",
                "items": [
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["name", "grams", "kcal100", "p100", "c100", "f100", "confidence"],
                    "properties": [
                        "name": string,
                        "grams": number,
                        "kcal100": number,
                        "p100": number,
                        "c100": number,
                        "f100": number,
                        "confidence": ["type": "string", "enum": ["high", "medium", "low"]]
                    ]
                ]
            ]
        ]
    ]

    static let lookup: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["category", "kcal", "protein", "carbs", "fat", "unitName", "unitGrams", "note"],
        "properties": [
            "category": ["type": "string", "enum": FoodCategory.allCases.map(\.rawValue)],
            "kcal": number,
            "protein": number,
            "carbs": number,
            "fat": number,
            "unitName": string,
            "unitGrams": number,
            "note": string
        ]
    ]
}
