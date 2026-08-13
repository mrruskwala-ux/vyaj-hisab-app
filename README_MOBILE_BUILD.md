# Vyaj Hisab - Mobile APK Build

This is a native Android WebView app containing the existing Vyaj Hisab web app.

## Data storage
The app uses WebView DOM storage/localStorage. On Android this data is kept in the app's private internal data area. It persists after closing/reopening the app. Uninstalling/clearing app data removes it.

## Build APK using only an Android phone
1. Create/sign in to a GitHub account.
2. Create a new repository, e.g. `vyaj-hisab-app`.
3. Upload all files/folders from this project to the repository (keep `.github/workflows/build-apk.yml`).
4. Open the repo's **Actions** tab.
5. Select **Build Vyaj Hisab APK** and tap **Run workflow**.
6. After the workflow completes, open the run and download the **Vyaj-Hisab-APK** artifact.
7. Extract the downloaded artifact and install `app-debug.apk` on your phone.

No client-link/server is included in this APK yet.
