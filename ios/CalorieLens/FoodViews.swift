import SwiftUI
import SwiftData

// MARK: - Portion sheet: pick a weight and see calories live

struct PortionSheet: View {
    let food: Food
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var useUnit: Bool
    @State private var amount: Double
    @State private var slot = MealSlot.now

    init(food: Food) {
        self.food = food
        _useUnit = State(initialValue: food.hasUnit)
        _amount = State(initialValue: food.hasUnit ? 1 : 100)
    }

    private var grams: Double { useUnit ? amount * food.unitGrams : amount }
    private var quickValues: [Double] { useUnit ? [0.5, 1, 2, 3] : [50, 100, 150, 200, 300] }

    var body: some View {
        let n = food.nutrition(grams: grams)
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    HStack(spacing: 12) {
                        FoodAvatar(name: food.name, category: food.category)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(food.name).font(.title3.bold())
                            Text(food.subtitle).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                    }

                    if food.hasUnit {
                        Picker("الوحدة", selection: $useUnit) {
                            Text(food.unitName).tag(true)
                            Text("غرام").tag(false)
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: useUnit) { wasUnit, isUnit in
                            let g = wasUnit ? amount * food.unitGrams : amount
                            amount = isUnit ? (g / food.unitGrams * 10).rounded() / 10 : g.rounded()
                        }
                    }

                    HStack(spacing: 10) {
                        stepButton("minus") { step(-1) }
                        TextField("0", value: $amount, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .frame(height: 54)
                            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.line))
                        stepButton("plus") { step(1) }
                    }
                    Text(useUnit ? "\(food.unitName) · \(fmt(grams)) غرام" : "غرام")
                        .font(.footnote).foregroundStyle(.secondary)

                    HStack(spacing: 8) {
                        ForEach(quickValues, id: \.self) { v in
                            ChipButton(title: useUnit ? (v == 0.5 ? "نصف" : fmt(v)) : "\(fmt(v)) غ",
                                       selected: amount == v) { amount = v }
                        }
                    }

                    VStack(spacing: 10) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(fmt(n.kcal))
                                .font(.system(size: 44, weight: .bold, design: .rounded))
                                .foregroundStyle(Theme.herb)
                                .contentTransition(.numericText())
                                .animation(.snappy, value: n.kcal)
                            Text("سعرة").foregroundStyle(.secondary)
                        }
                        HStack(spacing: 14) {
                            macro("بروتين", n.protein, Theme.protein)
                            macro("كربوهيدرات", n.carbs, Theme.carbs)
                            macro("دهون", n.fat, Theme.fat)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                    SlotChips(slot: $slot)

                    Button("أضف إلى \(slot.title)") { add(n) }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(grams <= 0)
                }
                .padding(18)
            }
            .background(Theme.surface)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() } }
            }
        }
        .presentationDetents([.large])
    }

    private func stepButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title2.bold())
                .frame(width: 54, height: 54)
                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func macro(_ title: String, _ value: Double, _ color: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text("\(title) \(fmt1(value)) غ").font(.caption)
        }
    }

    private func step(_ direction: Double) {
        let size = useUnit ? 0.5 : 10
        amount = max(0, ((amount + direction * size) * 10).rounded() / 10)
    }

    private func add(_ n: Nutrition) {
        let text = useUnit ? "\(fmt1(amount)) \(food.unitName) (\(fmt(grams)) غ)" : "\(fmt(grams)) غ"
        context.insert(MealEntry(name: food.name, slot: slot, amountText: text, grams: grams,
                                 nutrition: n, category: food.category, fromCamera: false))
        dismiss()
    }
}

// MARK: - Food list

struct FoodsView: View {
    @Query private var foods: [Food]
    @State private var search = ""
    @State private var category: FoodCategory?
    @State private var editing: Food?
    @State private var creating = false

    private var filtered: [Food] {
        sortedFoods(foods).filter {
            (category == nil || $0.category == category) &&
            (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("القيم لكل 100 غرام. اضغط على أي طعام لتعديله.")
                        .font(.footnote).foregroundStyle(.secondary)
                    CategoryChips(selection: $category)
                    LazyVStack(spacing: 8) {
                        ForEach(filtered) { food in
                            Button { editing = food } label: { FoodRow(food: food) }
                                .buttonStyle(.plain)
                        }
                    }
                    if filtered.isEmpty {
                        Text("لا يوجد طعام بهذا الاسم.").foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity).padding(20)
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("قائمة أطعمتي")
            .searchable(text: $search, prompt: "ابحث في القائمة")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { creating = true } label: { Label("طعام جديد", systemImage: "plus") }
                }
            }
            .sheet(item: $editing) { food in FoodEditor(food: food) }
            .sheet(isPresented: $creating) { FoodEditor(food: nil, initialName: search) }
        }
    }
}

// MARK: - Add or edit a food

struct FoodEditor: View {
    let food: Food?
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var category: FoodCategory
    @State private var kcal: Double?
    @State private var protein: Double?
    @State private var carbs: Double?
    @State private var fat: Double?
    @State private var unitName: String
    @State private var unitGrams: Double?
    @State private var loading = false
    @State private var message: String?
    @State private var confirmDelete = false

    init(food: Food?, initialName: String = "") {
        self.food = food
        _name = State(initialValue: food?.name ?? initialName)
        _category = State(initialValue: food?.category ?? .starch)
        _kcal = State(initialValue: food?.kcal)
        _protein = State(initialValue: food?.protein)
        _carbs = State(initialValue: food?.carbs)
        _fat = State(initialValue: food?.fat)
        _unitName = State(initialValue: food?.unitName ?? "")
        _unitGrams = State(initialValue: (food?.unitGrams ?? 0) > 0 ? food?.unitGrams : nil)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (kcal ?? -1) >= 0 &&
        (unitName.trimmingCharacters(in: .whitespaces).isEmpty || (unitGrams ?? 0) > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("اسم الطعام، مثل: مندي لحم", text: $name)
                    Button {
                        Task { await fill() }
                    } label: {
                        if loading {
                            HStack(spacing: 8) { ProgressView(); Text("جارٍ البحث عن القيم الغذائية…") }
                        } else {
                            Label("املأ القيم تلقائياً", systemImage: "sparkles")
                        }
                    }
                    .disabled(loading || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    if let message {
                        Text(message).font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section("التصنيف") {
                    Picker("التصنيف", selection: $category) {
                        ForEach(FoodCategory.allCases) { c in Text(c.title).tag(c) }
                    }
                }

                Section("القيم لكل 100 غرام") {
                    numberField("السعرات", $kcal)
                    numberField("بروتين (غ)", $protein)
                    numberField("كربوهيدرات (غ)", $carbs)
                    numberField("دهون (غ)", $fat)
                }

                Section {
                    TextField("اسم الحصة: حبة، كوب، ملعقة", text: $unitName)
                    numberField("وزن الحصة بالغرام", $unitGrams)
                } header: {
                    Text("حصة شائعة (اختياري)")
                } footer: {
                    Text("مثلاً: حبة = 120 غرام. تقدر بعدها تختار الكمية بعدد الحبات بدل الغرامات.")
                }

                if food != nil {
                    Section {
                        Button("حذف من القائمة", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(food == nil ? "طعام جديد" : "تعديل الطعام")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("إلغاء") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("حفظ") { save() }.disabled(!canSave) }
            }
            .confirmationDialog("حذف \(name) من القائمة؟", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("حذف", role: .destructive) {
                    if let food { context.delete(food) }
                    dismiss()
                }
            }
        }
    }

    private func numberField(_ title: String, _ value: Binding<Double?>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", value: value, format: .number)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 110)
        }
    }

    private func fill() async {
        loading = true
        message = nil
        do {
            let r = try await ClaudeService().lookup(name: name.trimmingCharacters(in: .whitespaces))
            kcal = r.kcal.rounded()
            protein = (r.protein * 10).rounded() / 10
            carbs = (r.carbs * 10).rounded() / 10
            fat = (r.fat * 10).rounded() / 10
            if !r.unitName.isEmpty && r.unitGrams > 0 {
                unitName = r.unitName
                unitGrams = r.unitGrams.rounded()
            }
            if let c = FoodCategory(rawValue: r.category) { category = c }
            message = (r.note.isEmpty ? "" : r.note + " ") + "راجع القيم وعدّلها إن لزم قبل الحفظ."
        } catch {
            message = (error as? LocalizedError)?.errorDescription ?? "تعذّر جلب القيم. اكتبها يدوياً."
        }
        loading = false
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedUnit = unitName.trimmingCharacters(in: .whitespaces)
        let grams = trimmedUnit.isEmpty ? 0 : (unitGrams ?? 0)
        if let food {
            food.name = trimmedName
            food.categoryRaw = category.rawValue
            food.kcal = kcal ?? 0
            food.protein = protein ?? 0
            food.carbs = carbs ?? 0
            food.fat = fat ?? 0
            food.unitName = trimmedUnit
            food.unitGrams = grams
        } else {
            context.insert(Food(name: trimmedName, category: category, kcal: kcal ?? 0,
                                protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0,
                                unitName: trimmedUnit, unitGrams: grams))
        }
        dismiss()
    }
}

// MARK: - Settings

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("dailyGoal") private var goal: Double = 2000
    @State private var key = ""
    @State private var hasKey = Keychain.load() != nil
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper(value: $goal, in: 800...6000, step: 50) {
                        HStack {
                            Text("الهدف اليومي")
                            Spacer()
                            Text("\(fmt(goal)) سعرة").foregroundStyle(.secondary)
                        }
                    }
                }

                Section {
                    SecureField(hasKey ? "المفتاح محفوظ. الصق مفتاحاً جديداً لتغييره" : "sk-ant-…", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("احفظ المفتاح") {
                        Keychain.save(key.trimmingCharacters(in: .whitespacesAndNewlines))
                        key = ""
                        hasKey = true
                        saved = true
                    }
                    .disabled(key.trimmingCharacters(in: .whitespaces).isEmpty)
                    if hasKey {
                        Button("حذف المفتاح", role: .destructive) {
                            Keychain.delete()
                            hasKey = false
                        }
                    }
                    if saved { Text("حُفظ المفتاح.").foregroundStyle(Theme.herb) }
                } header: {
                    Text("مفتاح Anthropic API")
                } footer: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("يُستخدم لتحليل الصور والتعبئة التلقائية، ويُحفظ مشفّراً في Keychain على جهازك فقط. التكلفة تُخصم من رصيد حسابك في Anthropic، وتقريباً بين 3 و10 سنتات لكل صورة.")
                        Link("أنشئ مفتاحاً من console.anthropic.com", destination: URL(string: "https://console.anthropic.com/settings/keys")!)
                    }
                }

                Section("عن الدقة") {
                    Text("تقدير السعرات من الصورة تقريبي، والخطأ المعتاد بين 10 و30%. للحصول على أدق نتيجة اكتب الوزن أو طريقة الطبخ في خانة التفاصيل، أو عدّل وزن كل مكوّن بعد التحليل.")
                        .font(.footnote)
                }
            }
            .navigationTitle("الإعدادات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() } }
            }
        }
    }
}
