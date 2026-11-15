# Oh, Crop! website

Self-contained snapshot of the website code, local inference server, model files and presentation samples. Website text is English. No credentials or saved camera captures are included.

## Files

- `assets/`: complete website HTML, CSS, JavaScript, advice cards and team logo.
- `python/main.py`: Flask API, USB camera capture, local ONNX inference and saved leaf events.
- `python/requirements.txt`: Python dependencies.
- `model/`: ONNX model and preprocessing/label metadata.
- `samples/`: presentation photos and their index.
- `app.yaml`: Arduino App Lab configuration.

## Website preview only

From this folder run:

```sh
python3 -m http.server 5173 --directory assets
```

Open http://localhost:5173. The model will show as offline; sensor panels are simulated.

## Website with local model (computer)

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r python/requirements.txt
CORN_DISABLE_CAMERA=1 PORT=8088 python python/main.py
```

Open http://localhost:8088. Image upload and presentation samples use the included model. The computer command disables the UNO Q camera integration. Saved results are created in `data/`.

## UNO Q

Use Arduino App Lab to package/import this app. The server uses Arduino camera peripherals available in the board runtime. This folder has not been deployed to the board; existing historical ZIPs are separate versions.

## Limitations and attribution

Corn screening covers healthy, common rust, gray leaf spot and northern leaf blight, with a target gate. Predictions are screening suggestions, not confirmed diagnoses. Real camera/field accuracy remains unvalidated. Environmental readings and the field layout remain simulated.

Sample photos: PlantVillage, Mohanty, Hughes and Salathé (2016), https://doi.org/10.3389/fpls.2016.01419 . Dataset author card: https://huggingface.co/datasets/mohanty/PlantVillage (CC BY-SA 3.0). Preserve attribution when sharing samples.
