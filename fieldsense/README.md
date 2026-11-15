# Oh, Crop!
English agricultural monitoring prototype for MadHack. Environmental readings, thermal visuals and field locations are simulated. The corn screening panel uses the same-origin local model API when served by the UNO Q app; the hosted static preview has no model connection.

## Run locally
`python3 -m http.server 5173 --directory dist`

Open http://localhost:5173. No dependency installation or build required.

## Demo interactions
Select a field on the schematic map or dropdown, switch chart metrics, use sidebar views, simulate a motion event, open and review an event, and export events as CSV.

## Integration points
`dist/app.js` contains sample field readings and events. Replace these fixtures with an API adapter after the team agrees on a sensor payload. Keep field ID, timestamp, metric, value and unit explicit. The thermal visualization is CSS artwork, not a camera feed. The field brief is a static sample interpretation, not an LLM response.

## Corn leaf integration
The dashboard now includes a corn leaf screening panel that calls the same-origin `/api/status`, `/api/predict`, and `/api/events` endpoints. Serve it through `../corn-leaf/app/python/main.py` for real ONNX inference; a static-only server shows the model as offline. The App Lab ZIP contains this dashboard. Existing environmental/thermal panels remain simulated. See `../corn-leaf/README.md` for training metrics and deployment status.
