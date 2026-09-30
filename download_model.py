import os
import sys
import tarfile
import urllib.request

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MODEL_NAME = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

# Primary and Mirror Download URLs
URLS = [
    f"https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/{MODEL_NAME}.tar.bz2",
    f"https://huggingface.co/csukuangfj/{MODEL_NAME}/resolve/main/{MODEL_NAME}.tar.bz2"
]

def download_progress(count, block_size, total_size):
    percent = int(count * block_size * 100 / total_size) if total_size > 0 else 0
    downloaded_mb = (count * block_size) / (1024 * 1024)
    total_mb = total_size / (1024 * 1024) if total_size > 0 else 0
    sys.stdout.write(f"\r[MODEL] Downloading: {percent}% ({downloaded_mb:.1f}/{total_mb:.1f} MB)")
    sys.stdout.flush()

def ensure_model_exists():
    os.makedirs(MODEL_DIR, exist_ok=True)
    target_folder = os.path.join(MODEL_DIR, MODEL_NAME)
    required_files = [
        os.path.join(target_folder, name)
        for name in ("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt")
    ]

    if all(os.path.isfile(path) for path in required_files):
        print(f"[OK] Model {MODEL_NAME} is already present at {target_folder}")
        return target_folder

    archive_path = os.path.join(MODEL_DIR, f"{MODEL_NAME}.tar.bz2")
    
    for url in URLS:
        print(f"[INFO] Attempting download from: {url}")
        try:
            urllib.request.urlretrieve(url, archive_path, reporthook=download_progress)
            print("\n[INFO] Extracting archive...")
            with tarfile.open(archive_path, "r:bz2") as tar:
                tar.extractall(path=MODEL_DIR)
            print("[OK] Extraction complete!")
            if os.path.exists(archive_path):
                os.remove(archive_path)
            return target_folder
        except Exception as e:
            print(f"\n[WARN] Download from {url} failed: {e}")

    print("[ERROR] The required ~630 MB Parakeet TDT 0.6B English model was not downloaded.")
    return None

if __name__ == "__main__":
    ensure_model_exists()
