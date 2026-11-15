"""Send simulated display states over USB; does not run image recognition."""
import argparse
import json
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", help="e.g. /dev/cu.usbmodemXXXX or /dev/ttyACM0")
    args = parser.parse_args()
    import serial  # pip install pyserial

    messages = [
        {"status": "ready"}, {"status": "too_far"},
        {"status": "too_close"}, {"status": "blurry"},
        {"status": "recognizing"},
        *({"status": "result", "label": label, "confidence": 0.92}
          for label in ("healthy", "common_rust", "gray_leaf_spot", "northern_leaf_blight")),
        {"status": "non_target"}, {"status": "too_dark"},
        {"status": "glare"}, {"status": "error"},
    ]
    with serial.Serial(args.port, 115200, timeout=1, write_timeout=2) as device:
        time.sleep(2)
        while True:
            for message in messages:
                print(message, flush=True)
                for _ in range(6):
                    device.write((json.dumps({"v": 1, **message, "environment": {"available": True, "temperature_c": 24.5, "humidity_pct": 61.2}}) + "\n").encode())
                    time.sleep(0.5)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
