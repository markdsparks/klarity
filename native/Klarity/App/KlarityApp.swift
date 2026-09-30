import SwiftUI

@main
struct KlarityApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            Tab("Scan", systemImage: "barcode.viewfinder") { ScanView() }
            Tab("History", systemImage: "clock.arrow.circlepath") { HistoryView() }
            Tab("You", systemImage: "person.crop.circle") { YouView() }
        }
    }
}
