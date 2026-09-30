import KlarityCore
import SwiftUI

/// Spec 009 M2 — the human signal raw stats can't give. Saved on this device only; exported by the user.
struct FeedbackSheet: View {
    let source: FeedbackSource
    let categories: [FeedbackCategory]
    var productName: String?
    var barcode: String?
    var title = "Something look off?"
    var notePrompt = "Anything that helps (optional)"
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var category: FeedbackCategory?
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(categories, id: \.self) { c in
                        Button { category = c } label: {
                            HStack {
                                Text(c.label).foregroundStyle(.primary)
                                Spacer()
                                if category == c { Image(systemName: "checkmark").foregroundStyle(Color.accentColor).fontWeight(.semibold) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section {
                    TextField(notePrompt, text: $note, axis: .vertical).lineLimit(2...5)
                } footer: {
                    Text("Saved on this device. You can export it from You → How Klarity's doing.")
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let category else { return }
                        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
                        model.logFeedback(FeedbackRecord(at: Date().timeIntervalSince1970 * 1000, source: source, category: category,
                                                         note: trimmed.isEmpty ? nil : trimmed, productName: productName, barcode: barcode))
                        dismiss()
                    }
                    .disabled(category == nil)
                }
            }
            .onAppear { if categories.count == 1 { category = categories[0] } }
        }
        .presentationDetents([.medium, .large])
    }
}

extension FeedbackCategory {
    var label: String {
        switch self {
        case .wrongVerdict: "The verdict felt wrong"
        case .wrongData: "The numbers look off"
        case .missingAdditive: "Missed an ingredient"
        case .notFound: "Here's what this was"
        case .other: "Something else"
        }
    }
}
