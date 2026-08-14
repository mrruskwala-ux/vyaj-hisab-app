package com.vyajhisab.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.provider.OpenableColumns;
import java.io.InputStream;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
import org.json.JSONObject;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font;
import com.tom_roush.pdfbox.text.PDFTextStripper;
import android.view.Window;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(0xFF6D28D9);
        w.setNavigationBarColor(0xFF000000);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        CookieManager.getInstance().setAcceptCookie(true);
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AndroidBridge(), "Android");
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    private Uri writeShareFile(String html, String filename) throws Exception {
        File dir = new File(getCacheDir(), "shared_hisab");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cache dir");
        // Sanitize filename so it cannot escape the cache directory.
        String safe = filename == null ? "Vyaj_Hisab.html" : filename.replaceAll("[^a-zA-Z0-9._\\-\\u0900-\\u097F]", "_");
        if (!safe.toLowerCase().endsWith(".html")) safe += ".html";
        File file = new File(dir, safe);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(html.getBytes(StandardCharsets.UTF_8));
        }
        return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
    }

    private void shareHtml(String html, String filename) {
        try {
            Uri uri = writeShareFile(html, filename);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/html");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // Prefer WhatsApp directly when installed; otherwise show Android share sheet.
            try {
                getPackageManager().getPackageInfo("com.whatsapp", 0);
                send.setPackage("com.whatsapp");
                startActivity(send);
            } catch (Exception noWhatsapp) {
                send.setPackage(null);
                startActivity(Intent.createChooser(send, "Client ka hisab bheje").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            }
        } catch (Exception e) {
            Toast.makeText(this, "Hisab share nahi ho saka: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private String htmlToPlainText(String html) {
        if (html == null) return "";

        String x = html;
        x = x.replaceAll("(?is)<br\\s*/?>", "\n");
        x = x.replaceAll("(?is)</p>", "\n");
        x = x.replaceAll("(?is)</h[1-6]>", "\n");
        x = x.replaceAll("(?is)</tr>", "\n");
        x = x.replaceAll("(?is)</td>", " | ");
        x = x.replaceAll("(?is)<[^>]+>", "");

        x = x.replace("&nbsp;", " ");
        x = x.replace("&amp;", "&");
        x = x.replace("&lt;", "<");
        x = x.replace("&gt;", ">");
        x = x.replace("&quot;", "\"");
        x = x.replace("&#39;", "'");

        x = x.replaceAll("[ \\t]+", " ");
        return x.trim();
    }

    private String pdfSafe(String text) {
        if (text == null) return "";

        StringBuilder b = new StringBuilder();

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);

            if (c == '\n' || c == '\r' || c == '\t') {
                b.append(c);
            } else if (c >= 32 && c <= 126) {
                b.append(c);
            } else {
                b.append('?');
            }
        }

        return b.toString();
    }

    private Uri writePdfFile(String html, String filename) throws Exception {
        File dir = new File(getCacheDir(), "shared_hisab");

        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("cache dir");
        }

        String safe = filename == null
                ? "Vyaj_Hisab.pdf"
                : filename.replaceAll("[^a-zA-Z0-9._\\-]", "_");

        if (!safe.toLowerCase().endsWith(".pdf")) {
            safe += ".pdf";
        }

        File file = new File(dir, safe);

        PDFBoxResourceLoader.init(getApplicationContext());

        String text = htmlToPlainText(html);
        String[] lines = text.split("\\r?\\n");

        try (PDDocument doc = new PDDocument()) {

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            final float margin = 40;
            final float fontSize = 9;
            final float leading = 14;

            float y = page.getMediaBox().getHeight() - margin;
            float maxWidth =
                    page.getMediaBox().getWidth() - (margin * 2);

            PDPageContentStream cs =
                    new PDPageContentStream(doc, page);

            cs.beginText();
            cs.setFont(PDType1Font.HELVETICA, fontSize);
            cs.newLineAtOffset(margin, y);

            for (String original : lines) {

                String remaining = pdfSafe(original);

                if (remaining.isEmpty()) {
                    cs.newLineAtOffset(0, -leading);
                    y -= leading;
                    continue;
                }

                while (!remaining.isEmpty()) {

                    String part = remaining;

                    while (
                            part.length() > 1 &&
                            PDType1Font.HELVETICA.getStringWidth(part)
                                    / 1000f * fontSize > maxWidth
                    ) {
                        part = part.substring(0, part.length() - 1);
                    }

                    if (part.length() < remaining.length()) {
                        int cut = part.lastIndexOf(' ');

                        if (cut > 0) {
                            part = part.substring(0, cut);
                        }
                    }

                    part = part.trim();

                    if (part.isEmpty()) {
                        part = remaining.substring(0, 1);
                    }

                    cs.showText(part);

                    remaining =
                            remaining.substring(
                                    Math.min(part.length(), remaining.length())
                            ).trim();

                    y -= leading;

                    if (y < margin) {

                        cs.endText();
                        cs.close();

                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);

                        y =
                                page.getMediaBox().getHeight()
                                        - margin;

                        cs =
                                new PDPageContentStream(doc, page);

                        cs.beginText();
                        cs.setFont(PDType1Font.HELVETICA, fontSize);
                        cs.newLineAtOffset(margin, y);

                    } else if (!remaining.isEmpty()) {

                        cs.newLineAtOffset(0, -leading);
                    }
                }

                if (y >= margin) {
                    cs.newLineAtOffset(0, -leading);
                    y -= leading;
                }
            }

            cs.endText();
            cs.close();

            doc.save(file);
        }

        return FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                file
        );
    }

    private void saveHtml(String html, String filename) {

        try {

            Uri uri = writePdfFile(html, filename);

            Intent send = new Intent(Intent.ACTION_SEND);

            send.setType("application/pdf");
            send.putExtra(Intent.EXTRA_STREAM, uri);

            send.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );

            startActivity(
                    Intent.createChooser(
                            send,
                            "PDF save/share karein"
                    ).addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
            );

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "PDF nahi ban saka: " + e.getMessage(),
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    public class AndroidBridge {

        @JavascriptInterface
        public void restoreBackup() {

            runOnUiThread(() -> {

                Intent pick =
                        new Intent(Intent.ACTION_OPEN_DOCUMENT);

                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("application/pdf");

                startActivityForResult(
                        pick,
                        1001
                );
            });
        }

        @JavascriptInterface
        public void shareClientHisab(
                String html,
                String filename
        ) {
            runOnUiThread(
                    () -> shareHtml(html, filename)
            );
        }

        @JavascriptInterface
        public void saveClientHisab(
                String html,
                String filename
        ) {
            runOnUiThread(
                    () -> saveHtml(html, filename)
            );
        }
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (
                requestCode == 1001 &&
                resultCode == RESULT_OK &&
                data != null &&
                data.getData() != null
        ) {

            try {

                Uri uri = data.getData();

                InputStream in =
                        getContentResolver()
                                .openInputStream(uri);

                if (in == null) {
                    throw new Exception(
                            "PDF open nahi hua"
                    );
                }

                File temp =
                        new File(
                                getCacheDir(),
                                "restore_backup.pdf"
                        );

                try (
                        FileOutputStream out =
                                new FileOutputStream(temp)
                ) {

                    byte[] buffer = new byte[8192];
                    int count;

                    while (
                            (count = in.read(buffer)) != -1
                    ) {
                        out.write(
                                buffer,
                                0,
                                count
                        );
                    }
                }

                in.close();

                PDFBoxResourceLoader.init(
                        getApplicationContext()
                );

                String text;

                try (
                        PDDocument doc =
                                PDDocument.load(temp)
                ) {

                    PDFTextStripper stripper =
                            new PDFTextStripper();

                    text =
                            stripper.getText(doc);
                }

                int start =
                        text.indexOf(
                                "RESTORE_DATA_START"
                        );

                int end =
                        text.indexOf(
                                "RESTORE_DATA_END"
                        );

                if (
                        start < 0 ||
                        end <= start
                ) {
                    throw new Exception(
                            "Ye Vyaj Hisab backup PDF nahi hai"
                    );
                }

                String encoded =
                        text.substring(
                                start +
                                        "RESTORE_DATA_START"
                                                .length(),
                                end
                        ).replaceAll(
                                "\\s+",
                                ""
                        );

                byte[] decoded =
                        android.util.Base64.decode(
                                encoded,
                                android.util.Base64.DEFAULT
                        );

                String json =
                        new String(
                                decoded,
                                StandardCharsets.UTF_8
                        );

                webView.evaluateJavascript(
                        "if(typeof restoreBackupData==='function'){" +
                        "restoreBackupData(" +
                        JSONObject.quote(json) +
                        ");}",
                        null
                );

            } catch (Exception e) {

                Toast.makeText(
                        this,
                        "Backup restore nahi ho saka: "
                                + e.getMessage(),
                        Toast.LENGTH_LONG
                ).show();
            }
        }
    }

    @Override public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript("(function(){if(history.state && history.state.vhView && history.state.vhView !== 'dashboard'){history.back();}else if(typeof Android !== 'undefined' && Android.exitApp){Android.exitApp();}})()", null);
        } else {
            super.onBackPressed();
        }
    }
}
