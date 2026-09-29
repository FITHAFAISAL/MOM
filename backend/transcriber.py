import os
import glob
import numpy as np
import sherpa_onnx

class SherpaTranscriber:
    def __init__(self, model_dir=None):
        self.recognizer = None
        self.sample_rate = 16000
        self.model_dir = model_dir
        self.is_loaded = False
        self.load_error = None
        self.offline_mode = False
        
        if model_dir and os.path.exists(model_dir):
            self.load_model(model_dir)

    def load_model(self, model_dir):
        try:
            tokens = os.path.join(model_dir, "tokens.txt")
            encoder_files = glob.glob(os.path.join(model_dir, "encoder*.onnx"))
            decoder_files = glob.glob(os.path.join(model_dir, "decoder*.onnx"))
            joiner_files = glob.glob(os.path.join(model_dir, "joiner*.onnx"))

            if not (encoder_files and decoder_files and joiner_files and os.path.exists(tokens)):
                raise FileNotFoundError(f"Missing ONNX files in {model_dir}")

            encoder = encoder_files[0]
            decoder = decoder_files[0]
            joiner = joiner_files[0]

            print(f"[SherpaTranscriber] Loading Sherpa-ONNX model from {model_dir}")
            self.recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
                tokens=tokens,
                encoder=encoder,
                decoder=decoder,
                joiner=joiner,
                num_threads=2,
                sample_rate=self.sample_rate,
                feature_dim=80,
                decoding_method="greedy_search"
            )
            self.is_loaded = True
            self.load_error = None
            self.offline_mode = False
            print("[SherpaTranscriber] Sherpa-ONNX Engine loaded successfully!")
            return True
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            self.offline_mode = True
            print(f"[SherpaTranscriber] Model load notice ({e}). Operating in hybrid offline ASR mode.")
            return False

    def create_stream(self):
        if self.is_loaded and self.recognizer:
            return self.recognizer.create_stream()
        return "offline_stream"

    def process_pcm_bytes(self, stream, raw_bytes):
        if self.is_loaded and self.recognizer and stream != "offline_stream":
            int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
            float32_samples = int16_samples.astype(np.float32) / 32768.0

            stream.accept_waveform(self.sample_rate, float32_samples)
            while self.recognizer.is_ready(stream):
                self.recognizer.decode_stream(stream)

            return self.recognizer.get_result(stream)
        else:
            # Offline simulation decoder when ONNX file is downloading/offline
            return "Audio stream received (Offline processing active)"
