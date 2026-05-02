/**
 * Smart Voice Translator Application
 * 
 * Features:
 * - Speech recognition in multiple languages
 * - Real-time translation to English
 * - Audio output of translated text
 * - Secure context detection
 * 
 * Browser Compatibility: Chrome, Firefox, Safari (with -webkit prefix)
 */

(function () {
    // ============================================
    // DOM ELEMENT REFERENCES
    // ============================================
    const warningBox = document.getElementById('warningBox');
    const secureUrlSpan = document.getElementById('secureUrl');
    const micButton = document.getElementById('micButton');
    const statusText = document.getElementById('statusText');
    const transcriptText = document.getElementById('transcriptText');
    const translationText = document.getElementById('translationText');
    const sourceLanguage = document.getElementById('sourceLanguage');
    const spinner = document.getElementById('spinner');

    // ============================================
    // STATE VARIABLES
    // ============================================
    let recognition = null;           // Speech Recognition API instance
    let isRecording = false;           // Track recording state
    let finalTranscript = '';          // Final recognized text
    let lastTranslation = '';          // Last successful translation

    // ============================================
    // ENVIRONMENT DETECTION
    // ============================================
    const isSecure = window.isSecureContext;                  // HTTPS or localhost
    const isFileProtocol = window.location.protocol === 'file:';  // file:// protocol
    const isWhatsApp = /WhatsApp/i.test(navigator.userAgent); // WhatsApp browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; // Cross-browser support

    /**
     * Display warning if opening from insecure context
     * (file:// or WhatsApp browser cannot access microphone)
     */
    function showWarning() {
        if (isSecure && !isFileProtocol && !isWhatsApp) {
            return; // All good, don't show warning
        }

        warningBox.classList.add('show');
        secureUrlSpan.textContent = 'https://YOUR_USERNAME.github.io/translator/translator.html';
    }

    // ============================================
    // UI UPDATE FUNCTIONS
    // ============================================

    /**
     * Update status message displayed to user
     */
    function setStatus(message) {
        statusText.textContent = message;
    }

    /**
     * Update transcript (recognized text) display
     */
    function setTranscript(message) {
        transcriptText.textContent = message;
        transcriptText.classList.remove('placeholder');
    }

    /**
     * Update translation display
     */
    function setTranslation(message) {
        translationText.textContent = message;
        translationText.classList.remove('placeholder');
    }

    /**
     * Reset UI to idle state after recording stops
     */
    function resetUI() {
        isRecording = false;
        micButton.classList.remove('recording');
        micButton.textContent = '🎤';
        setStatus(finalTranscript ? '✅ Done' : 'Click to speak');
    }

    /**
     * Stop speech recognition and reset UI
     */
    function stopRecognition() {
        isRecording = false;
        if (recognition) {
            try {
                recognition.stop();
            } catch (error) {
                // Ignore errors during stop
            }
        }
        resetUI();
    }

    // ============================================
    // PERMISSIONS & INITIALIZATION
    // ============================================

    /**
     * Request microphone permission from user
     * Returns true if granted, false if denied
     */
    async function requestMicPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Release the stream
            return true;
        } catch (error) {
            setStatus('⛔ Microphone denied. Allow access in browser settings.');
            return false;
        }
    }

    // ============================================
    // SPEECH RECOGNITION SETUP
    // ============================================

    /**
     * Initialize and configure Web Speech API
     * Sets up event listeners for recognition lifecycle
     */
    function initRecognition() {
        recognition = new SpeechRecognition();
        recognition.continuous = true;        // Keep listening for multiple words
        recognition.interimResults = true;    // Show results as they're being spoken
        recognition.lang = sourceLanguage.value; // Set language from dropdown
        recognition.maxAlternatives = 1;      // Return best match only

        // ========== Recognition Start ==========
        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording'); // Red glow effect
            micButton.textContent = '⏺️';
            setStatus('🔴 Listening... Speak now');
            finalTranscript = '';
            setTranscript('');
        };

        // ========== Results Incoming ==========
        recognition.onresult = (event) => {
            let interimText = ''; // Partial text while speaking

            // Process results from current session
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    // Final result - confirmed
                    finalTranscript += transcript;
                } else {
                    // Interim result - still being spoken
                    interimText += transcript;
                }
            }

            // Display combined text (final + interim)
            setTranscript((finalTranscript + interimText).trim() || '...');

            // Start translation if we have enough text
            if (finalTranscript.trim().length >= 3) {
                translateText(finalTranscript.trim());
            }
        };

        // ========== Error Handling ==========
        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                setStatus('🎤 No speech detected. Try again.');
            } else if (event.error === 'not-allowed') {
                setStatus('⛔ Microphone permission denied');
                stopRecognition();
            } else {
                setStatus('⚠️ Error: ' + event.error);
            }
        };

        // ========== Recognition End ==========
        recognition.onend = () => {
            if (isRecording) {
                // If still recording, restart listening
                try {
                    recognition.start();
                } catch (error) {
                    stopRecognition();
                }
            } else {
                resetUI();
            }
        };

        recognition.start();
    }

    // ============================================
    // TRANSLATION ENGINE
    // ============================================

    /**
     * Translate text using Google Translate API
     * @param {string} text - Text to translate
     */
    async function translateText(text) {
        if (text.length < 3) {
            return; // Ignore very short text
        }

        spinner.classList.add('active');
        setTranslation('Translating...');

        // Extract language code (e.g., "en" from "en-US")
        const sourceLang = sourceLanguage.value.split('-')[0];
        
        // Build Google Translate API URL
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            // Extract translation from response
            const translation = Array.isArray(data[0])
                ? data[0].map(segment => segment[0]).join('') // Combine all segments
                : '';

            if (!translation) {
                throw new Error('Translation failed');
            }

            setTranslation(translation.trim());
            lastTranslation = translation.trim();
        } catch (error) {
            setTranslation('⚠️ Translation failed');
        } finally {
            spinner.classList.remove('active');
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    /**
     * Microphone button click handler
     * Toggles between recording and idle state
     */
    micButton.addEventListener('click', async () => {
        if (isRecording) {
            stopRecognition();
            return;
        }

        // Check if context is secure (HTTPS required for microphone)
        if (!isSecure && !isFileProtocol) {
            setStatus('⚠️ Open secure link to use microphone');
            return;
        }

        // Request microphone permission
        const granted = await requestMicPermission();
        if (!granted) {
            return;
        }

        // Stop any existing recognition before starting new one
        if (recognition) {
            try {
                recognition.stop();
            } catch (error) {
                // Ignore
            }
        }

        initRecognition();
    });

    /**
     * Language dropdown change handler
     * Restarts recognition when language changes
     */
    sourceLanguage.addEventListener('change', () => {
        if (!isRecording) {
            return;
        }
        stopRecognition();
        setStatus('🔄 Language changed. Click to speak.');
    });

    /**
     * Copy button click handler
     * Copies translated text to clipboard
     */
    document.getElementById('copyBtn').addEventListener('click', async () => {
        const text = lastTranslation || translationText.textContent;
        if (!text || text.includes('failed') || text.includes('English')) {
            return;
        }
        await navigator.clipboard.writeText(text);
        setStatus('📋 Copied');
        setTimeout(() => setStatus('Click to speak'), 2000);
    });

    /**
     * Speak button click handler
     * Uses Web Speech API to read translation aloud
     */
    document.getElementById('speakBtn').addEventListener('click', () => {
        if (!lastTranslation) {
            return;
        }
        const utterance = new SpeechSynthesisUtterance(lastTranslation);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    });

    /**
     * Clear button click handler
     * Resets all displayed text
     */
    document.getElementById('clearBtn').addEventListener('click', () => {
        finalTranscript = '';
        lastTranslation = '';
        transcriptText.textContent = 'Waiting for input...';
        transcriptText.classList.add('placeholder');
        translationText.textContent = 'Translation will appear here...';
        translationText.classList.add('placeholder');
        setStatus('Click to speak');
        stopRecognition();
    });

    // ============================================
    // INITIALIZATION
    // ============================================

    showWarning();

    // Check if browser supports Web Speech API
    if (!SpeechRecognition) {
        setStatus('❌ Browser does not support speech recognition');
        micButton.disabled = true;
    }
})();
