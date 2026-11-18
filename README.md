# ∑ DersPDF — Gemini Konuşmalarından YKS Çalışma PDF'i

**DersPDF**, Gemini (veya ChatGPT / Claude) ile yaptığınız soru-çözüm ve konu anlatımı konuşmalarını; bozuk LaTeX formüllerini otomatik onararak, görselleri ve şekilleri koruyarak, **GoodNotes / Notability / Apple Pencil** veya doğrudan A4 baskı için optimize edilmiş çalışma föylerine dönüştüren tek dosyalı (offline-first PWA) bir web uygulamasıdır.

🔗 **Canlı Uygulama (GitHub Pages):** [https://sunbleachedfly.github.io/derspdf/](https://sunbleachedfly.github.io/derspdf/)

---

## ✨ Özellikler

- **Akıllı LaTeX & Markdown Onarımı (`Yapıştır & Onar`):** Gemini'den kopyalanan `$$...$$`, `$...$`, `\[...\]`, `\(...\)` matematik bloklarını ve bozuk satır içi formülleri otomatik temizler, KaTeX ile vektörel kalitede işler.
- **YKS Vurgu Kutuları (Callouts):** `> [!SORU]`, `> [!ÇÖZÜM]`, `> [!FORMÜL]`, `> [!UYARI]`, `> [!İPUCU]` bloklarını ders föyü formatında renklendirir.
- **Görsel & Grafik Desteği:** Panodan doğrudan görsel yapıştırma (`Ctrl/Cmd + V`), sürükle-bırak ve boyutlandırma (`![Açıklama|75%](...)`).
- **GoodNotes / Tablet & A4 Baskı Düzeni:**
  - Çizgili, Noktalı, Kareli veya Düz kağıt arka planı
  - Apple Pencil / Kalem çözüm alanı (Sağ %35 karalama sütunu)
  - Sıcak Krem (GoodNotes), Klasik Beyaz ve Gece (Koyu) kağıt temaları
- **Çift Çıktı Motoru:**
  - **Vektörel PDF / Yazdır (`Cmd/Ctrl + P`):** Metin seçilebilir, sonsuz yakınlaştırılabilir keskin matematiksel PDF
  - **Direkt PDF İndir (`html2pdf`):** Tek tıkla doğrudan `.pdf` dosyası indirme
- **IndexedDB Otomatik Kayıt & Arşiv:** Tüm çalışma föyleriniz ve yüklediğiniz görseller tarayıcınızda yerel olarak saklanır, internet bağlantısı olmadan da çalışır.

## 🚀 Kullanım

1. [https://sunbleachedfly.github.io/derspdf/](https://sunbleachedfly.github.io/derspdf/) adresini açın (veya depodaki `DersPDF.html` dosyasını bilgisayarınıza/tabletinize indirip doğrudan tarayıcıda açın).
2. Gemini konuşmanızı kopyalayıp **Yapıştır & Onar** butonuna tıklayın.
3. Üst araç çubuğundan ders etiketi, kağıt deseni, tema ve **Kalem Alanı** ayarlarını seçin.
4. **Vektörel PDF / Yazdır** veya **Direkt PDF İndir** ile föyünüzü kaydedin.
