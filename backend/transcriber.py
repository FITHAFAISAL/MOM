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
        self.offline_mode = True  # 100% offline mandatory
        
        if model_dir and os.path.exists(model_dir):
            self.load_model(model_dir)

    def load_model(self, model_dir):
        try:
            tokens = os.path.join(model_dir, "tokens.txt")
            encoder_files = glob.glob(os.path.join(model_dir, "encoder*.onnx"))
            decoder_files = glob.glob(os.path.join(model_dir, "decoder*.onnx"))
            joiner_files = glob.glob(os.path.join(model_dir, "joiner*.onnx"))

            # Filter out int8 if non-int8 available or use whichever is present
            standard_encoders = [f for f in encoder_files if "int8" not in f]
            encoder = standard_encoders[0] if standard_encoders else encoder_files[0]
            
            standard_decoders = [f for f in decoder_files if "int8" not in f]
            decoder = standard_decoders[0] if standard_decoders else decoder_files[0]
            
            standard_joiners = [f for f in joiner_files if "int8" not in f]
            joiner = standard_joiners[0] if standard_joiners else joiner_files[0]

            if not (encoder and decoder and joiner and os.path.exists(tokens)):
                raise FileNotFoundError(f"Missing ONNX files in {model_dir}")

            print(f"[SherpaTranscriber] Initializing 100% Offline ASR Engine from: {model_dir}")
            self.recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
                tokens=tokens,
                encoder=encoder,
                decoder=decoder,
                joiner=joiner,
                num_threads=2,
                sample_rate=self.sample_rate,
                feature_dim=80,
                decoding_method="greedy_search",
                enable_endpoint_detection=True,
                rule1_min_trailing_silence=1.8,
                rule2_min_trailing_silence=0.8,
                rule3_min_utterance_length=20.0
            )
            self.is_loaded = True
            self.load_error = None
            self.offline_mode = True
            print("[SherpaTranscriber] Offline Sherpa-ONNX Engine loaded & ready for air-gapped transcription!")
            return True
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            print(f"[SherpaTranscriber] Model load notice: {e}")
            return False

    def create_stream(self):
        if self.is_loaded and self.recognizer:
            return self.recognizer.create_stream()
        return None

    def decode_chunk(self, stream, raw_bytes):
        """
        Processes a raw PCM16 byte chunk from mic or device audio.
        Returns (text: str, is_endpoint: bool)
        """
        if not self.is_loaded or not self.recognizer or not stream or not raw_bytes:
            return ("", False)

        try:
            int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
            if len(int16_samples) == 0:
                return ("", False)

            float32_samples = int16_samples.astype(np.float32) / 32768.0
            stream.accept_waveform(self.sample_rate, float32_samples)

            while self.recognizer.is_ready(stream):
                self.recognizer.decode_stream(stream)

            text = self.recognizer.get_result(stream)
            is_endpoint = self.recognizer.is_endpoint(stream)

            if is_endpoint:
                self.recognizer.reset(stream)

            return (text, is_endpoint)
        except Exception as e:
            print(f"[SherpaTranscriber] Decode error: {e}")
            return ("", False)

    def finalize_stream(self, stream):
        """
        Finalizes an open stream when user stops listening.
        Returns final text and resets.
        """
        if not self.is_loaded or not self.recognizer or not stream:
            return ""

        try:
            stream.input_finished()
            while self.recognizer.is_ready(stream):
                self.recognizer.decode_stream(stream)
            text = self.recognizer.get_result(stream)
            self.recognizer.reset(stream)
            return text
        except Exception as e:
            print(f"[SherpaTranscriber] Finalize error: {e}")
            return ""

    def process_pcm_bytes(self, stream, raw_bytes):
        text, _ = self.decode_chunk(stream, raw_bytes)
        return text
