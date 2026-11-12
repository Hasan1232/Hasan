import SwiftUI
import SwiftData
import PhotosUI
import UIKit

struct AddView: View {
    @Environment(\.modelContext) private var context
    @Query private var foods: [Food]
    @State private var search = ""
    @State private var category: FoodCategory?
    @State private var portionFood: Food?
    @State private var showCamera = false
    @State private var showEditor = false
    @State private var photoItem: PhotosPickerItem?
    @State private var scan: ScanSession?
    @State private var needKey = false
    @State private var showSettings = false

    private var filtered: [Food] {
        sortedFoods(foods).filter {
            (category == nil || $0.category == category) &&
            (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    cameraCard
                    if let scan {
                        ScanCard(session: scan) { self.scan = nil }
                    }
                    HStack {
                        Text("أو اختر من قائمتك").font(.headline)
                        Spacer()
                        Button("طعام جديد") { showEditor = true }
                    }
                    CategoryChips(selection: $category)
                    LazyVStack(spacing: 8) {
                        ForEach(filtered) { food in
                            Button { portionFood = food } label: { FoodRow(food: food, showPlus: true) }
                                .buttonStyle(.plain)
                        }
                    }
                    if filtered.isEmpty {
                        VStack(spacing: 10) {
                            Text("لا يوجد طعام بهذا الاسم في قائمتك.").foregroundStyle(.secondary)
                            Button("أضفه إلى القائمة") { showEditor = true }
                                .buttonStyle(PrimaryButtonStyle())
                                .frame(maxWidth: 240)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(20)
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("أضف وجبة")
            .searchable(text: $search, prompt: "ابحث: رز، دجاج، تمر…")
            .sheet(item: $portionFood) { food in PortionSheet(food: food) }
            .sheet(isPresented: $showEditor) { FoodEditor(food: nil, initialName: search) }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { image in startScan(image) }
                    .ignoresSafeArea()
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        startScan(image)
                    }
                    photoItem = nil
                }
            }
            .alert("أضف مفتاح API أولاً", isPresented: $needKey) {
                Button("فتح الإعدادات") { showSettings = true }
                Button("إلغاء", role: .cancel) {}
            } message: {
                Text("تحليل الصور يحتاج مفتاح Anthropic API. أضفه مرة واحدة من الإعدادات.")
            }
        }
    }

    private var cameraCard: some View {
        VStack(spacing: 10) {
            Button {
                guard Keychain.load() != nil else { needKey = true; return }
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    showCamera = true
                }
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "camera.fill")
                        .font(.title2)
                        .foregroundStyle(Theme.hero)
                        .frame(width: 54, height: 54)
                        .background(Theme.saffron, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("صوّر الطبق").font(.title3.bold())
                        Text("يتعرّف على المكوّنات ويقدّر الوزن والسعرات")
                            .font(.footnote)
                            .foregroundStyle(Theme.heroMuted)
                    }
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Theme.heroInk)
                .padding(18)
                .background(Theme.hero, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(scan?.loading == true)

            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("اختر صورة من المعرض", systemImage: "photo.on.rectangle")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.line))
            }
            .buttonStyle(.plain)
        }
    }

    private func startScan(_ image: UIImage) {
        guard Keychain.load() != nil else { needKey = true; return }
        let session = ScanSession(image: image)
        scan = session
        Task { await session.run() }
    }
}

// MARK: - Scan

@MainActor
@Observable
final class ScanSession {
    let image: UIImage
    var note = ""
    var loading = false
    var error: String?
    var dish = ""
    var items: [ScanItem] = []
    var notes = ""
    var slot = MealSlot.now

    init(image: UIImage) {
        self.image = image
    }

    var total: Nutrition { items.reduce(Nutrition()) { $0 + $1.nutrition } }

    var range: (Double, Double) {
        items.reduce((0.0, 0.0)) { acc, item in
            let k = item.nutrition.kcal
            return (acc.0 + k * (1 - item.errorShare), acc.1 + k * (1 + item.errorShare))
        }
    }

    func run() async {
        loading = true
        error = nil
        do {
            let result = try await ClaudeService().analyze(image: image, note: note)
            dish = result.dish
            items = result.items
            notes = result.notes
            if items.isEmpty {
                error = notes.isEmpty ? "لم أتعرف على طعام في الصورة. جرّب صورة أوضح." : notes
            }
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "تعذّر تحليل الصورة. حاول مرة أخرى."
        }
        loading = false
    }
}

struct ScanCard: View {
    @Bindable var session: ScanSession
    let onClose: () -> Void
    @Environment(\.modelContext) private var context
    @Query private var foods: [Food]
    @State private var savedMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(uiImage: session.image)
                .resizable()
                .scaledToFill()
                .frame(height: 220)
                .frame(maxWidth: .infinity)
                .clipped()

            VStack(alignment: .leading, spacing: 14) {
                if session.loading {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("جارٍ التعرّف على الطعام وتقدير الكميات… قد يستغرق ذلك حتى دقيقة.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                } else if let error = session.error {
                    Text(error).foregroundStyle(Theme.fat)
                    noteField
                    HStack(spacing: 10) {
                        Button("أعد التحليل") { Task { await session.run() } }
                            .buttonStyle(PrimaryButtonStyle())
                        Button("إغلاق", action: onClose)
                            .buttonStyle(PrimaryButtonStyle(filled: false))
                    }
                } else {
                    result
                }
            }
            .padding(16)
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.line))
    }

    private var noteField: some View {
        TextField("تفاصيل تزيد الدقة: الوزن، طريقة الطبخ…", text: $session.note, axis: .vertical)
            .padding(10)
            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func gramsBinding(_ id: UUID) -> Binding<Double> {
        Binding(
            get: { session.items.first(where: { $0.id == id })?.grams ?? 0 },
            set: { value in
                if let i = session.items.firstIndex(where: { $0.id == id }) {
                    session.items[i].grams = max(0, value)
                }
            }
        )
    }

    @ViewBuilder
    private var result: some View {
        let total = session.total
        let range = session.range
        Text(session.dish).font(.title3.bold())
        HStack(alignment: .firstTextBaseline) {
            Text(fmt(total.kcal)).font(.system(size: 34, weight: .bold, design: .rounded)).foregroundStyle(Theme.herb)
            Text("سعرة")
            Spacer()
            Text("النطاق المتوقع \(fmt(range.0)) – \(fmt(range.1))")
                .font(.caption).foregroundStyle(.secondary)
        }
        Text("بروتين \(fmt(total.protein)) غ · كربوهيدرات \(fmt(total.carbs)) غ · دهون \(fmt(total.fat)) غ")
            .font(.footnote).foregroundStyle(.secondary)

        VStack(spacing: 0) {
            ForEach(session.items) { item in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(item.name).font(.body.weight(.semibold))
                        Spacer()
                        Text("\(fmt(item.nutrition.kcal)) سعرة").font(.body.weight(.semibold))
                    }
                    HStack(spacing: 10) {
                        HStack(spacing: 4) {
                            TextField("0", value: gramsBinding(item.id), format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.center)
                                .frame(width: 64)
                                .padding(.vertical, 4)
                                .background(Theme.bg, in: RoundedRectangle(cornerRadius: 8))
                            Text("غ")
                        }
                        Text("\(fmt(item.kcal100)) سعرة/100غ").foregroundStyle(.secondary)
                        ConfidenceTag(level: item.confidence)
                        Spacer()
                        Button("إزالة") {
                            let id = item.id
                            session.items.removeAll { $0.id == id }
                        }
                        .foregroundStyle(.secondary)
                    }
                    .font(.caption)
                }
                .padding(.vertical, 10)
                Divider()
            }
        }

        if !session.notes.isEmpty {
            Text(session.notes).font(.footnote).foregroundStyle(.secondary)
        }
        noteField
        SlotChips(slot: $session.slot)
        Button("أضف إلى \(session.slot.title)") { addMeal() }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(session.items.isEmpty)
        HStack(spacing: 10) {
            Button("احفظ المكوّنات في قائمتي") { saveItems() }
                .buttonStyle(PrimaryButtonStyle(filled: false))
            Button("أعد التحليل") { Task { await session.run() } }
                .buttonStyle(PrimaryButtonStyle(filled: false))
        }
        if let savedMessage {
            Text(savedMessage).font(.footnote).foregroundStyle(Theme.herb)
        }
        Button("تجاهل", action: onClose)
            .frame(maxWidth: .infinity)
            .foregroundStyle(.secondary)
    }

    private func addMeal() {
        let grams = session.items.reduce(0) { $0 + $1.grams }
        let thumb = session.image.resized(maxSide: 240).jpegData(compressionQuality: 0.7)
        context.insert(MealEntry(name: session.dish, slot: session.slot,
                                 amountText: "\(fmt(grams)) غ من صورة", grams: grams,
                                 nutrition: session.total, category: .starch,
                                 fromCamera: true, photo: thumb))
        onClose()
    }

    private func saveItems() {
        let existing = Set(foods.map(\.name))
        var added = 0
        for item in session.items where !existing.contains(item.name) {
            context.insert(Food(name: item.name, category: .starch, kcal: item.kcal100.rounded(),
                                protein: item.p100, carbs: item.c100, fat: item.f100))
            added += 1
        }
        savedMessage = added > 0 ? "حُفظ \(added) مكوّن في قائمتك." : "كل المكوّنات موجودة في قائمتك."
    }
}

struct ConfidenceTag: View {
    let level: String

    var body: some View {
        let (title, color): (String, Color) = {
            switch level {
            case "high": return ("ثقة عالية", Theme.herb)
            case "low": return ("ثقة منخفضة", Theme.fat)
            default: return ("ثقة متوسطة", Theme.saffronInk)
            }
        }()
        Text(title)
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(color.opacity(0.14), in: Capsule())
            .foregroundStyle(color)
    }
}

// MARK: - Camera

struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker

        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onImage(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
