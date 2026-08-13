package com.vyajhisab.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
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

    private void saveHtml(String html, String filename) {
        try {
            Uri uri = writeShareFile(html, filename);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/html");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(send, "Client Hisab save/share karein").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
        } catch (Exception e) {
            Toast.makeText(this, "File save nahi ho saki: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    public class AndroidBridge {
        @JavascriptInterface public void shareClientHisab(String html, String filename) { runOnUiThread(() -> shareHtml(html, filename)); }
        @JavascriptInterface public void saveClientHisab(String html, String filename) { runOnUiThread(() -> saveHtml(html, filename)); }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
