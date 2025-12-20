class SpeechSynthesis
{
    private static voices: any[] = [];

    public static async speakShortText(message: string): Promise<void> 
    {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        const messageWithPause = message.replace(' ', '… '); // For very short speech, adding a tiny pause improves naturalness
        const utterance = new SpeechSynthesisUtterance(messageWithPause);
        utterance.lang = 'en-US';
        utterance.rate = 1.08; // Faster = less robotic
        utterance.pitch = 1.05; // For 2-word phrases, the default pacing is often too slow and flat.

        if (!SpeechSynthesis.voices.length) {
            await SpeechSynthesis.loadVoices();
        }

        // Prefer high-quality voices
        const preferredVoice =
            SpeechSynthesis.voices.find((v:any) => v.name.includes('Google') && v.lang === 'en-US') ||
            SpeechSynthesis.voices.find((v:any) => v.name.includes('Microsoft') && v.lang === 'en-US') ||
            SpeechSynthesis.voices.find((v:any) => v.lang === 'en-US');

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    public static loadVoices(): Promise<SpeechSynthesisVoice[]> {
        return new Promise(resolve => {
            const v = speechSynthesis.getVoices();
            console.log("voices", v);
            if (v.length) {
                SpeechSynthesis.voices = v;
                resolve(v);
            } else {
                speechSynthesis.onvoiceschanged = () => {
                    SpeechSynthesis.voices = speechSynthesis.getVoices();
                    resolve(SpeechSynthesis.voices);
                };
            }
        });
    }
}

document.addEventListener('click', async () => { // chrome does not load voices until user interaction happend
    await SpeechSynthesis.loadVoices();
}, { once: true });

export { SpeechSynthesis };
