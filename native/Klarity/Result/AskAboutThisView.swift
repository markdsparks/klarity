import KlarityCore
import SwiftUI

/// Spec 014 — "Ask about this", inside the evidence sheets. Renders nothing unless the on-device model is
/// available (no Apple Intelligence → the sheet is exactly as it was). Stateless: each question stands alone.
struct AskAboutThisSection: View {
    let ask: AskContext

    private enum Phase: Equatable {
        case idle
        case asking(String)
        case answered(String, AskAboutThis.Answer)
    }

    @State private var question = ""
    @State private var phase: Phase = .idle
    @FocusState private var focused: Bool

    var body: some View {
        if AskAboutThis.isAvailable {
            Section {
                HStack {
                    TextField(placeholder, text: $question)
                        .focused($focused)
                        .submitLabel(.send)
                        .onSubmit(submit)
                        .disabled(isAsking)
                    if isAsking {
                        ProgressView()
                    } else {
                        Button("Ask", action: submit)
                            .fontWeight(.semibold)
                            .disabled(question.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                switch phase {
                case .idle: EmptyView()
                case .asking(let q):
                    Text("You asked: \u{201C}\(q)\u{201D}").font(.caption).foregroundStyle(.secondary)
                case .answered(let q, let a):
                    VStack(alignment: .leading, spacing: 6) {
                        Text("You asked: \u{201C}\(q)\u{201D}").font(.caption).foregroundStyle(.secondary)
                        Text(a.text)
                        if a.grounded {
                            Label("From Klarity's own rules, computed on this device", systemImage: "checkmark.seal")
                                .font(.caption).foregroundStyle(Theme.goodText)
                        }
                    }
                }
            } header: {
                Text("Ask about this")
            } footer: {
                Text("Answers come only from Klarity's own rules and this product's numbers — never medical advice.")
            }
        }
    }

    private var isAsking: Bool { if case .asking = phase { true } else { false } }

    private var placeholder: String {
        if case .answered = phase { return "Ask another question…" }
        return "e.g. what if I add flax seed?"
    }

    private func submit() {
        let q = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !isAsking else { return }
        focused = false
        question = ""
        phase = .asking(q)
        Task {
            let a = await AskAboutThis.ask(q, about: ask)
            phase = .answered(q, a)
        }
    }
}
