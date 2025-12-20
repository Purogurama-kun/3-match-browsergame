// SpeechSynthesis.ts
// Reliable cross-browser Web Speech wrapper (Chrome / Firefox / Safari)

class SpeechSynthesis {
    private static voices: SpeechSynthesisVoice[] = [];

    /**
     * Speaks very short text (1–2 words) in a game-friendly way.
     */
    public static async speakShortText(message: string): Promise<void> {
        if (!('speechSynthesis' in window)) return;

        if (SpeechSynthesis.voices.length == 0) {
            SpeechSynthesis.voices = speechSynthesis.getVoices();
        }

        // Micro-pause improves naturalness for short phrases
        const text = message.replace(' ', '… ');

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.08;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;

        // Prefer best available voice
        const voice =
            this.voices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
            this.voices.find(v => v.name.includes('Microsoft') && v.lang === 'en-US') ||
            this.voices.find(v => v.lang === 'en-US');

        if (voice) {
            utterance.voice = voice;
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
}

export { SpeechSynthesis };
