# Christmas Catch

Face-tracking Christmas catch game (MindAR + A-Frame). Static HTML/JS — no webpack.

## Play on this PC

- VS Code: right-click `index.html` → **Open with Live Server**, or
- Double-click `Play.bat` (needs Node.js)

Use `http://127.0.0.1:…` — not `file://` and not port 8080.

## Play on a phone (camera)

Phones **require HTTPS**. LAN `http://192.168…` blocks the camera.

```bash
npm run phone
```

Open the printed `https://….trycloudflare.com` link on the phone (padlock in the address bar).

## Rich media upload

Zip only: `index.html`, `script.js`, `style.css`, `campaign.json`, `src/`, `vendor/`.

```bash
npm run pack
```

Entry file: `index.html`. Host must be **HTTPS**. If the ad iframe blocks the camera, the player can tap **Try again** to open full page.
