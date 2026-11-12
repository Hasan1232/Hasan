import SwiftUI
import SwiftData
import Charts

struct TodayView: View {
    @Binding var tab: AppTab
    @Environment(\.modelContext) private var context
    @Query(sort: \MealEntry.date) private var meals: [MealEntry]
    @AppStorage("dailyGoal") private var goal: Double = 2000
    @State private var showSettings = false

    private var todayMeals: [MealEntry] {
        meals.filter { Calendar.current.isDateInToday($0.date) }
    }

    private var total: Nutrition {
        todayMeals.reduce(Nutrition()) { $0 + $1.nutrition }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(Date(), format: .dateTime.weekday(.wide).day().month(.wide))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HeroCard(eaten: total.kcal, goal: goal)
                    MacroRow(total: total, goal: goal)
                    WeekCard(meals: meals, goal: goal)
                    Text("وجبات اليوم").font(.headline)
                    mealsSection
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("عدسة السعرات")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("الإعدادات")
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    @ViewBuilder
    private var mealsSection: some View {
        if todayMeals.isEmpty {
            VStack(spacing: 12) {
                Text("لم تسجّل أي وجبة اليوم.").foregroundStyle(.secondary)
                Button("أضف وجبتك الأولى") { tab = .add }
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(maxWidth: 240)
            }
            .frame(maxWidth: .infinity)
            .padding(22)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.line, style: StrokeStyle(lineWidth: 1.5, dash: [6])))
        } else {
            ForEach(MealSlot.allCases) { slot in
                let items = todayMeals.filter { $0.slot == slot }
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(slot.title).font(.subheadline.weight(.semibold))
                            Spacer()
                            Text("\(fmt(items.reduce(0) { $0 + $1.kcal })) سعرة")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 4)
                        ForEach(items) { meal in
                            MealRow(meal: meal) { context.delete(meal) }
                        }
                    }
                }
            }
        }
    }
}

struct HeroCard: View {
    let eaten: Double
    let goal: Double

    var body: some View {
        let left = goal - eaten
        HStack(spacing: 20) {
            ZStack {
                Circle().stroke(Theme.heroTrack, lineWidth: 13)
                Circle()
                    .trim(from: 0, to: min(eaten / max(goal, 1), 1))
                    .stroke(left < 0 ? Theme.fat : Theme.saffron, style: StrokeStyle(lineWidth: 13, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.6), value: eaten)
                VStack(spacing: 2) {
                    Text(fmt(eaten)).font(.system(size: 30, weight: .bold, design: .rounded))
                    Text("سعرة اليوم").font(.caption).foregroundStyle(Theme.heroMuted)
                }
            }
            .frame(width: 132, height: 132)

            VStack(alignment: .leading, spacing: 6) {
                Text(left >= 0 ? "\(fmt(left)) سعرة متبقية" : "تجاوزت الهدف بـ \(fmt(-left))")
                    .font(.title3.bold())
                    .fixedSize(horizontal: false, vertical: true)
                Text("من هدف \(fmt(goal)) سعرة")
                    .font(.footnote)
                    .foregroundStyle(Theme.heroMuted)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(Theme.heroInk)
        .padding(20)
        .background(Theme.hero, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

struct MacroRow: View {
    let total: Nutrition
    let goal: Double

    var body: some View {
        // Targets: 25% protein, 50% carbs, 25% fat of the daily goal.
        HStack(spacing: 10) {
            MacroCard(title: "بروتين", value: total.protein, target: goal * 0.25 / 4, color: Theme.protein)
            MacroCard(title: "كربوهيدرات", value: total.carbs, target: goal * 0.5 / 4, color: Theme.carbs)
            MacroCard(title: "دهون", value: total.fat, target: goal * 0.25 / 9, color: Theme.fat)
        }
    }
}

struct MacroCard: View {
    let title: String
    let value: Double
    let target: Double
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(fmt(value)).font(.headline)
                Text("/ \(fmt(target)) غ").font(.caption2).foregroundStyle(.secondary)
            }
            ProgressView(value: min(value / max(target, 1), 1))
                .tint(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line))
    }
}

struct WeekCard: View {
    let meals: [MealEntry]
    let goal: Double

    struct Day: Identifiable {
        let id: Int
        let label: String
        let kcal: Double
        let isToday: Bool
    }

    private var days: [Day] {
        let cal = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ar")
        formatter.dateFormat = "EEE"
        return (0..<7).map { i in
            let date = cal.date(byAdding: .day, value: i - 6, to: Date()) ?? Date()
            let kcal = meals.filter { cal.isDate($0.date, inSameDayAs: date) }.reduce(0) { $0 + $1.kcal }
            return Day(id: i, label: i == 6 ? "اليوم" : formatter.string(from: date), kcal: kcal, isToday: i == 6)
        }
    }

    var body: some View {
        let ds = days
        let logged = ds.filter { $0.kcal > 0 }
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("آخر ٧ أيام").font(.headline)
                Spacer()
                if !logged.isEmpty {
                    Text("المتوسط \(fmt(logged.reduce(0) { $0 + $1.kcal } / Double(logged.count))) سعرة")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Chart {
                ForEach(ds) { d in
                    BarMark(x: .value("اليوم", d.label), y: .value("السعرات", d.kcal), width: .fixed(22))
                        .foregroundStyle(d.kcal > goal ? Theme.fat : (d.isToday ? Theme.herb : Theme.herb.opacity(0.3)))
                        .cornerRadius(6)
                }
                RuleMark(y: .value("الهدف", goal))
                    .foregroundStyle(Color.gray)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
            .chartXScale(domain: ds.map(\.label))
            .chartYAxis(.hidden)
            .frame(height: 150)
        }
        .card()
    }
}

struct MealRow: View {
    let meal: MealEntry
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            FoodAvatar(name: meal.name, category: meal.category, photo: meal.photo)
            VStack(alignment: .leading, spacing: 2) {
                Text(meal.name).font(.body.weight(.semibold)).lineLimit(1)
                Text("\(meal.amountText) · ب \(fmt(meal.protein)) ك \(fmt(meal.carbs)) د \(fmt(meal.fat))")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 0) {
                Text(fmt(meal.kcal)).font(.headline)
                Text("سعرة").font(.caption2).foregroundStyle(.secondary)
            }
            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
                    .frame(width: 34, height: 34)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .accessibilityLabel("حذف \(meal.name)")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.line))
    }
}
