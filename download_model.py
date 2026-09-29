import os
import sys
import tarfile
import urllib.request

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

MODEL_NAME = "sherpa-onnx-streaming-zipformer-en-2023-06-26"
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
    tokens = os.path.join(target_folder, "tokens.txt")
    encoder = os.path.join(target_folder, "encoder-epoch-99-avg-1.onnx")
    
    if os.path.exists(tokens) and os.path.exists(encoder):
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

    print("[OFFLINE] No internet model download completed. Platform operating in Offline Browser ASR & NLP Engine Mode.")
    return None

if __name__ == "__main__":
    ensure_model_exists()
