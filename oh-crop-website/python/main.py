"""Local CPU inference API and FieldSense dashboard for the UNO Q Linux side."""
import io
import hashlib
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps, UnidentifiedImageError
from flask import Flask, jsonify, request, send_from_directory, Response

ROOT = Path(__file__).resolve().parents[1]
META = json.loads((ROOT / 'model/model_metadata.json').read_text())
DISPLAY = {'healthy':'Healthy leaf','common_rust':'Suspected common rust',
           'gray_leaf_spot':'Suspected gray leaf spot','northern_leaf_blight':'Suspected northern leaf blight'}
options = ort.SessionOptions(); options.intra_op_num_threads = 2
SESSION = ort.InferenceSession(str(ROOT/'model/corn_joint.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
GATE_META = json.loads((ROOT/'model/corn_gate_metadata.json').read_text())
WEB = Flask(__name__, static_folder=None)
WEB.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
STORE = Path(os.environ.get('CORN_DATA_DIR', str(ROOT/'data')))
STORE.mkdir(exist_ok=True, parents=True)
LOCK = threading.Lock()
try: EVENTS = json.loads((STORE/'events.json').read_text())
except (OSError, ValueError): EVENTS = []
CAMERA = {'jpeg':None,'updated':0,'error':'Camera is starting'}
SAMPLE_HASHES = {hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'samples').glob('*.jpg')}

def camera_loop():
    camera = None
    try:
        from arduino.app_peripherals.camera import Camera
        import cv2
        camera = Camera(0, resolution=(640,480), fps=10)
        camera.start()
        while True:
            frame = camera.capture()
            if frame is None: continue
            ok, buf = cv2.imencode('.jpg',frame)
            if ok:
                with LOCK: CAMERA.update(jpeg=buf.tobytes(),updated=time.time(),error=None)
    except Exception as e:
        with LOCK: CAMERA['error'] = f'Camera unavailable: {e}. Image upload is available.'
        print(CAMERA['error'],flush=True)
    finally:
        if camera:
            try: camera.stop()
            except Exception: pass

def store_event(event, image_bytes):
    with LOCK:
        (STORE/(event['id']+'.jpg')).write_bytes(image_bytes)
        EVENTS.insert(0,event)
        expired = EVENTS[100:];del EVENTS[100:]
        for old in expired: (STORE/(old['id']+'.jpg')).unlink(missing_ok=True)
        temp=STORE/'events.tmp';temp.write_text(json.dumps(EVENTS));temp.replace(STORE/'events.json')

def infer(raw, source, field, persist=True):
    with Image.open(io.BytesIO(raw)) as image:
        if image.width*image.height > 24_000_000: raise ValueError('Image exceeds 24 megapixels')
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((1280,1280))
        saved = io.BytesIO();image.save(saved,format='JPEG',quality=85)
        x = np.asarray(image.resize((224,224),Image.Resampling.BILINEAR),dtype=np.float32)/255
    x = (x-np.array(META['mean'],np.float32))/np.array(META['std'],np.float32)
    x = np.transpose(x,(2,0,1))[None].copy()
    start = time.perf_counter()
    outputs=SESSION.run(None,{'image':x})
    gate_logits=outputs[1][0]
    gate_exp=np.exp(gate_logits-gate_logits.max());gate_prob=gate_exp/gate_exp.sum()
    corn_probability=float(gate_prob[GATE_META['labels'].index('corn_leaf')])
    threshold=GATE_META['corn_acceptance_threshold']
    if corn_probability < threshold:
        event = {'id':uuid.uuid4().hex,'timestamp':datetime.now(timezone.utc).isoformat(),
                'label':'non_target','display':'No corn leaf confirmed',
                'confidence':1-corn_probability,'target_probability':corn_probability,
                'target_threshold':threshold,'inference_ms':round((time.perf_counter()-start)*1000,1),
                'source':source,'field':field,'status':'non_target','model':'corn-gate + corn-mobilenetv3-small',
                'probabilities':{},'gate_probabilities':{l:float(gate_prob[i]) for i,l in enumerate(GATE_META['labels'])}}
        if persist: store_event(event,saved.getvalue())
        return event
    logits = outputs[0][0]
    elapsed = (time.perf_counter()-start)*1000
    exp = np.exp(logits-logits.max());prob=exp/exp.sum();idx=int(prob.argmax())
    label = META['labels'][idx];confidence=float(prob[idx])
    confident = confidence >= .8  # UI review heuristic, not calibrated/OOD detection.
    event = {'id':uuid.uuid4().hex,'timestamp':datetime.now(timezone.utc).isoformat(),
             'label':label,'display':DISPLAY[label] if confident else 'Uncertain — retake leaf photo',
             'confidence':confidence,'inference_ms':round(elapsed,1),'source':source,'field':field,
             'status':'prediction' if confident else 'uncertain','model':'corn-mobilenetv3-small',
             'target_probability':corn_probability,'target_threshold':threshold,
             'probabilities':{l:float(prob[i]) for i,l in enumerate(META['labels'])}}
    if not persist:
        return event
    store_event(event,saved.getvalue())
    print(json.dumps(event),flush=True)
    return event

@WEB.get('/')
def index(): return send_from_directory(ROOT/'assets','index.html')

@WEB.get('/api/status')
def status():
    with LOCK:
        camera = {'available':CAMERA['jpeg'] is not None and time.time()-CAMERA['updated']<5,'error':CAMERA['error']}
    return jsonify(model='corn-mobilenetv3-small',labels=META['labels'],camera=camera,
                   target_gate=True,target_threshold=GATE_META['corn_acceptance_threshold'],
                   test_accuracy=META['test_accuracy'],split_note=META['split_note'],local_inference=True)

@WEB.get('/api/events')
def events():
    with LOCK: return jsonify(EVENTS)

@WEB.get('/api/snapshot')
def snapshot():
    with LOCK:
        if CAMERA['jpeg'] is None or time.time()-CAMERA['updated']>5:
            return jsonify(error=CAMERA['error'] or 'Camera frame is stale'),503
        return Response(CAMERA['jpeg'],mimetype='image/jpeg',headers={'Cache-Control':'no-store'})

@WEB.get('/api/stream')
def stream():
    def frames():
        previous = 0
        while True:
            with LOCK:
                raw, updated = CAMERA['jpeg'], CAMERA['updated']
            if raw is not None and updated != previous and time.time()-updated < 5:
                previous=updated
                yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + raw + b'\r\n'
            time.sleep(.08)
    return Response(frames(),mimetype='multipart/x-mixed-replace; boundary=frame',headers={'Cache-Control':'no-store'})

@WEB.post('/api/live-predict')
def live_predict():
    with LOCK:
        if CAMERA['jpeg'] is None or time.time()-CAMERA['updated']>5:
            return jsonify(error=CAMERA['error'] or 'Camera frame is stale'),503
        raw=CAMERA['jpeg']
    return jsonify(infer(raw,'Live UNO Q USB camera','unassigned',persist=False))

@WEB.post('/api/predict')
def predict():
    if request.form.get('corn_leaf_confirmed') != 'true':
        return jsonify(error='Confirm that the image contains one corn leaf close-up'),400
    field = request.form.get('field','unassigned')
    if field not in ['north','south','unassigned']:return jsonify(error='Invalid field'),400
    try:
        if 'image' in request.files:
            raw=request.files['image'].read();source='Uploaded image'
            if hashlib.sha256(raw).hexdigest() in SAMPLE_HASHES:
                source='Held-out PlantVillage test photo'
        else:
            with LOCK:
                if CAMERA['jpeg'] is None or time.time()-CAMERA['updated']>5:
                    return jsonify(error=CAMERA['error'] or 'Camera frame is stale'),503
                raw=CAMERA['jpeg']
            source='UNO Q USB camera'
        return jsonify(infer(raw,source,field))
    except (UnidentifiedImageError,ValueError,OSError,Image.DecompressionBombError) as e:
        return jsonify(error=f'Invalid image: {e}'),400

@WEB.get('/api/images/<event_id>.jpg')
def saved_image(event_id):
    if len(event_id)!=32 or any(c not in '0123456789abcdef' for c in event_id):return '',404
    return send_from_directory(STORE,event_id+'.jpg')

@WEB.get('/samples/<path:name>')
def samples(name):return send_from_directory(ROOT/'samples',name)

@WEB.get('/<path:name>')
def assets(name):return send_from_directory(ROOT/'assets',name)

@WEB.errorhandler(413)
def too_large(error):return jsonify(error='Image must be smaller than 10 MB'),413

if __name__ == '__main__':
    if os.environ.get('CORN_DISABLE_CAMERA')=='1':
        CAMERA['error']='Camera disabled in this computer preview; upload or test a leaf photo.'
    else:
        threading.Thread(target=camera_loop,daemon=True).start()
    WEB.run(host='0.0.0.0',port=int(os.environ.get('PORT','8080')),threaded=True)
