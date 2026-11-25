# Weapon viewer

Check a weapon's model, skin and poses in the real first-person view. Use it for every change to a weapon. The parameters are described under "Debug mode (weapon viewer)" in `AGENTS.md`.

## Steps

Only the Vite client is needed. The MCP browser has no WebGL, so use headless Chromium. `$ART` is `$VERIFY_DIR/artifacts/weapon-viewer`.

```bash
shot() {
  chromium --headless=new --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
    --ignore-gpu-blocklist --window-size=1400,850 --virtual-time-budget=30000 \
    --screenshot="$ART/$1.png" "http://127.0.0.1:5273/?viewer&$2"
}
shot azt 'weapon=azt'
shot azt-carrapeta 'weapon=azt&skin=carrapeta'
shot azt-reload 'weapon=azt&reload=0.4'
```

Shoot every weapon, skin and pose the change touches.

## Proof

- Open each picture and say what it shows. A file on disk is not a proof.
- Run the same URL with `--dump-dom` and check for `<title>viewer:ready</title>`. `viewer:error` means no WebGL.
- Motion cannot be judged from still frames. Report it as unverified.
