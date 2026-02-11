package popatiya.mabazaar.com;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.geolocation.GeolocationPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    registerPlugin(GeolocationPlugin.class);
    registerPlugin(FilesystemPlugin.class);

    this.bridge.getWebView().setWebViewClient(new WebViewClient() {
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url != null && url.endsWith(".pdf")) {
          Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
          startActivity(intent);
          return true;
        }
        return super.shouldOverrideUrlLoading(view, url);
      }
    });
  }
}
