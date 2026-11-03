import SwiftUI
import WebKit

@main
struct JRSGuindastesApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .tint(Color(red: 0.94, green: 0.75, blue: 0.10))
        }
    }
}

/// Navegador nativo do app JRS. A sessão usa o armazenamento persistente do WebKit,
/// independente do Safari e de outros navegadores (sem sincronização automática).
@MainActor
final class JRSBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let homeURL = URL(string: "https://jrs-smart-rental.onrender.com/")!
    @Published var loading = true
    @Published var hasError = false
    @Published var canGoBack = false
    @Published var title = "JRS Guindastes"
    @Published var popup: WKWebView? = nil

    let webView: WKWebView

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.055, green: 0.066, blue: 0.08, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: Self.homeURL))
    }

    func home() {
        hasError = false
        webView.load(URLRequest(url: Self.homeURL))
    }

    func reload() {
        hasError = false
        webView.reload()
    }

    func back() {
        if webView.canGoBack { webView.goBack() }
        else { home() }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loading = true
        hasError = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loading = false
        canGoBack = webView.canGoBack
        if let pageTitle = webView.title, !pageTitle.isEmpty { title = pageTitle }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loading = false
        hasError = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loading = false
        hasError = true
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let scheme = (url.scheme ?? "").lowercased()
        if ["tel", "mailto", "sms", "waze"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        if scheme == "http" || scheme == "https" {
            let host = url.host?.lowercased() ?? ""
            let trusted = host == "jrs-smart-rental.onrender.com" ||
                host == "www.jrsguindaste.com.br" || host == "jrsguindaste.com.br"
            if !trusted {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    // As Ordens de Serviço JRS usam window.open() para preparar impressão/PDF.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, let host = url.host?.lowercased(),
           !["jrs-smart-rental.onrender.com", "www.jrsguindaste.com.br", "jrsguindaste.com.br"].contains(host) {
            UIApplication.shared.open(url)
            return nil
        }
        let child = WKWebView(frame: .zero, configuration: configuration)
        child.uiDelegate = self
        child.navigationDelegate = self
        popup = child
        return child
    }

    func webViewDidClose(_ webView: WKWebView) {
        popup = nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "JRS Guindastes", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Confirmar", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Confirmar", style: .default) { _ in completionHandler(true) })
        present(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: "JRS Guindastes", message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(alert.textFields?.first?.text)
        })
        present(alert)
    }

    private func present(_ alert: UIAlertController) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            // Never abandon a WebKit completion handler if no presentation context exists.
            // In normal use, the browser has a foreground key window.
            return
        }
        var current = root
        while let presented = current.presentedViewController { current = presented }
        current.present(alert, animated: true)
    }
}

struct WebContainer: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

struct ContentView: View {
    @StateObject private var browser = JRSBrowser()
    @State private var sharing = false
    @State private var showingHelp = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.055, green: 0.066, blue: 0.08).ignoresSafeArea()
                WebContainer(webView: browser.webView)
                    .ignoresSafeArea(edges: .bottom)

                if browser.hasError {
                    VStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 32))
                            .foregroundStyle(.yellow)
                        Text("Sem conexão com o sistema JRS")
                            .font(.headline)
                        Text("Verifique sua internet e tente novamente. Os dados desta versão não são sincronizados automaticamente entre dispositivos.")
                            .font(.footnote).multilineTextAlignment(.center)
                        Button("Tentar novamente") { browser.home() }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding(25)
                    .frame(maxWidth: .infinity)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
                    .padding(25)
                }
            }
            .navigationTitle("JRS GUINDASTES")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(red: 0.10, green: 0.13, blue: 0.11), for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: browser.back) {
                        Image(systemName: "chevron.left")
                    }
                    .accessibilityLabel("Voltar")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button(action: browser.home) { Image(systemName: "house") }
                        .accessibilityLabel("Página inicial JRS")
                    Button(action: browser.reload) { Image(systemName: "arrow.clockwise") }
                        .accessibilityLabel("Atualizar")
                    Menu {
                        Button("Compartilhar acesso", systemImage: "square.and.arrow.up") { sharing = true }
                        Button("Abrir no Safari", systemImage: "safari") {
                            UIApplication.shared.open(JRSBrowser.homeURL)
                        }
                        Button("Sobre o aplicativo", systemImage: "info.circle") { showingHelp = true }
                    } label: { Image(systemName: "ellipsis.circle") }
                        .accessibilityLabel("Mais opções")
                }
            }
            .overlay(alignment: .top) {
                if browser.loading {
                    ProgressView()
                        .tint(.yellow)
                        .padding(4)
                }
            }
            .sheet(isPresented: $sharing) {
                ShareSheet(items: [JRSBrowser.homeURL])
                    .presentationDetents([.medium])
            }
            .sheet(item: Binding(
                get: { browser.popup.map { PopupItem(webView: $0) } },
                set: { _ in browser.popup = nil }
            )) { item in
                DocumentView(webView: item.webView) { browser.popup = nil }
            }
            .alert("Sobre o JRS Guindastes", isPresented: $showingHelp) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Aplicativo de gestão de locações, ordens de serviço, frota, RH e operações. Esta versão usa dados locais do WebKit; não substitui um sistema de armazenamento compartilhado.")
            }
        }
    }
}

private struct PopupItem: Identifiable {
    let webView: WKWebView
    var id: ObjectIdentifier { ObjectIdentifier(webView) }
}

private struct DocumentView: View {
    let webView: WKWebView
    let close: () -> Void

    var body: some View {
        NavigationStack {
            WebContainer(webView: webView)
                .navigationTitle("Documento JRS")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Fechar", action: close)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            let printer = UIPrintInteractionController.shared
                            printer.printFormatter = webView.viewPrintFormatter()
                            printer.present(animated: true)
                        } label: { Label("Imprimir / PDF", systemImage: "printer") }
                    }
                }
        }
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
