import os
import numpy as np
import sherpa_onnx

class SherpaTranscriber:
    MODEL_NAME = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
    MODEL_FILES = ("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt")
    SILENCE_RMS_THRESHOLD = 0.003
    SILENCE_DURATION_SECONDS = 0.8
    PARTIAL_INTERVAL_SECONDS = 1.5
    MAX_UTTERANCE_SECONDS = 15.0
    MIN_SPEECH_SECONDS = 0.25
    PRE_ROLL_SECONDS = 0.2
    SPLIT_SEARCH_SECONDS = 4.0

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
            encoder, decoder, joiner, tokens = (
                os.path.join(model_dir, name) for name in self.MODEL_FILES
            )

            if not all(os.path.isfile(path) for path in (tokens, encoder, decoder, joiner)):
                raise FileNotFoundError(f"Missing Parakeet ONNX files in {model_dir}")

            print(f"[SherpaTranscriber] Loading required Parakeet TDT 0.6B offline model from: {model_dir}")
            self.recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
                tokens=tokens,
                encoder=encoder,
                decoder=decoder,
                joiner=joiner,
                num_threads=max(2, min(4, os.cpu_count() or 2)),
                sample_rate=self.sample_rate,
                feature_dim=80,
                decoding_method="greedy_search",
                model_type="nemo_transducer",
            )
            self.is_loaded = True
            self.load_error = None
            self.offline_mode = True
            print("[SherpaTranscriber] Parakeet TDT 0.6B English offline model loaded.")
            return True
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            print(f"[SherpaTranscriber] Model load notice: {e}")
            return False

    def create_stream(self, sample_rate=None):
        if self.is_loaded and self.recognizer:
            return {
                "sample_rate": int(sample_rate or self.sample_rate),
                "chunks": [],
                "pre_roll": [],
                "pre_roll_samples": 0,
                "speech_samples": 0,
                "silence_samples": 0,
                "segment_samples": 0,
                "last_partial_samples": 0,
                "last_partial_text": "",
                "speech_started": False,
            }
        return None

    def _reset_stream(self, stream, carry_over=None):
        # Keep the negotiated sample rate across segments
        fresh = self.create_stream(stream["sample_rate"])
        if carry_over is not None and len(carry_over):
            fresh["chunks"] = [carry_over]
            fresh["segment_samples"] = len(carry_over)
            fresh["speech_samples"] = len(carry_over)
            fresh["speech_started"] = True
        stream.update(fresh)

    def _find_split_point(self, samples, sample_rate):
        """Index of the quietest short window near the end, so long speech is not cut mid-word."""
        frame = max(1, int(0.02 * sample_rate))
        search = int(self.SPLIT_SEARCH_SECONDS * sample_rate)
        start = max(0, len(samples) - search)
        region = samples[start:]
        frame_count = len(region) // frame
        if frame_count < 3:
            return len(samples)
        energy = np.square(region[:frame_count * frame]).reshape(frame_count, frame).mean(axis=1)
        smoothed = np.convolve(energy, np.ones(5) / 5, mode="same")
        return start + (int(np.argmin(smoothed[1:-1])) + 1) * frame + frame // 2

    def _decode_samples(self, samples, input_sample_rate):
        if len(samples) == 0:
            return ""
        offline_stream = self.recognizer.create_stream()
        offline_stream.accept_waveform(input_sample_rate, samples)
        self.recognizer.decode_stream(offline_stream)
        return offline_stream.result.text.strip()

    def _decode_segment(self, chunks, input_sample_rate, trailing_silence_samples=0):
        samples = np.concatenate(chunks)
        if trailing_silence_samples:
            samples = samples[:-min(trailing_silence_samples, len(samples))]
        return self._decode_samples(samples, input_sample_rate)

    def decode_chunk(self, stream, raw_bytes):
        if not self.is_loaded or not self.recognizer or not stream or not raw_bytes:
            return ("", False)

        try:
            int16_samples = np.frombuffer(raw_bytes, dtype=np.int16)
            if len(int16_samples) == 0:
                return ("", False)

            float32_samples = int16_samples.astype(np.float32) / 32768.0
            sample_count = len(float32_samples)
            input_sample_rate = stream["sample_rate"]
            rms = float(np.sqrt(np.mean(np.square(float32_samples))))
            is_speech = rms >= self.SILENCE_RMS_THRESHOLD

            if not stream["speech_started"] and not is_speech:
                stream["pre_roll"].append(float32_samples)
                stream["pre_roll_samples"] += sample_count
                while stream["pre_roll_samples"] > int(self.PRE_ROLL_SECONDS * input_sample_rate):
                    removed = stream["pre_roll"].pop(0)
                    stream["pre_roll_samples"] -= len(removed)
                return ("", False)

            if not stream["speech_started"]:
                stream["chunks"].extend(stream["pre_roll"])
                stream["segment_samples"] = stream["pre_roll_samples"]
                stream["pre_roll"] = []
                stream["pre_roll_samples"] = 0
                stream["speech_started"] = True

            stream["chunks"].append(float32_samples)
            stream["segment_samples"] += sample_count

            if is_speech:
                stream["speech_samples"] += sample_count
                stream["silence_samples"] = 0
            else:
                stream["silence_samples"] += sample_count

            speech_duration = stream["speech_samples"] / input_sample_rate
            silence_duration = stream["silence_samples"] / input_sample_rate
            utterance_duration = stream["segment_samples"] / input_sample_rate

            if silence_duration >= self.SILENCE_DURATION_SECONDS:
                text = ""
                if speech_duration >= self.MIN_SPEECH_SECONDS:
                    # Decode without trimming: a quiet tail may still hold soft speech
                    text = self._decode_segment(stream["chunks"], input_sample_rate)
                self._reset_stream(stream)
                return (text, True)

            if utterance_duration >= self.MAX_UTTERANCE_SECONDS:
                # No natural pause: cut at the quietest point and carry the remainder forward
                samples = np.concatenate(stream["chunks"])
                split = self._find_split_point(samples, input_sample_rate)
                text = self._decode_samples(samples[:split], input_sample_rate)
                self._reset_stream(stream, carry_over=samples[split:])
                return (text, True)

            partial_interval = int(self.PARTIAL_INTERVAL_SECONDS * input_sample_rate)
            samples_since_partial = stream["segment_samples"] - stream["last_partial_samples"]
            if (
                speech_duration >= self.MIN_SPEECH_SECONDS
                and samples_since_partial >= partial_interval
            ):
                stream["last_partial_samples"] = stream["segment_samples"]
                partial_text = self._decode_segment(
                    stream["chunks"],
                    input_sample_rate,
                    stream["silence_samples"],
                )
                if partial_text and partial_text != stream["last_partial_text"]:
                    stream["last_partial_text"] = partial_text
                    return (partial_text, False)
            return ("", False)
        except Exception as e:
            print(f"[SherpaTranscriber] Decode error: {e}")
            return ("", False)

    def finalize_stream(self, stream):
        if not self.is_loaded or not self.recognizer or not stream:
            return ""

        try:
            if not stream["speech_started"] or stream["speech_samples"] / stream["sample_rate"] < self.MIN_SPEECH_SECONDS:
                return ""
            text = self._decode_segment(
                stream["chunks"],
                stream["sample_rate"],
                stream["silence_samples"],
            )
            self._reset_stream(stream)
            return text
        except Exception as e:
            print(f"[SherpaTranscriber] Finalize error: {e}")
            return ""

    def process_pcm_bytes(self, stream, raw_bytes):
        text, _ = self.decode_chunk(stream, raw_bytes)
        return text
