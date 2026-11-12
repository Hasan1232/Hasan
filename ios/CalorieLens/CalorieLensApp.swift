import SwiftUI
import SwiftData

@main
struct CalorieLensApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar@numbers=latn"))
                .tint(Theme.herb)
        }
        .modelContainer(for: [Food.self, MealEntry.self])
    }
}

enum AppTab: Hashable {
    case today, add, foods
}

struct RootView: View {
    @Environment(\.modelContext) private var context
    @AppStorage("seededBuiltinFoodsV1") private var seeded = false
    @State private var tab: AppTab = .today

    var body: some View {
        TabView(selection: $tab) {
            TodayView(tab: $tab)
                .tabItem { Label("اليوم", systemImage: "chart.pie.fill") }
                .tag(AppTab.today)
            AddView()
                .tabItem { Label("أضف", systemImage: "plus.circle.fill") }
                .tag(AppTab.add)
            FoodsView()
                .tabItem { Label("أطعمتي", systemImage: "list.bullet") }
                .tag(AppTab.foods)
        }
        .task {
            if !seeded {
                BuiltinFoods.seed(into: context)
                seeded = true
            }
        }
    }
}
