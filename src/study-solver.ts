/**
 * Prolific Study Solver - AI-Assisted Survey Answering (Final Refined Version)
 */
// @ts-ignore: Isolated scope

const SOLVER_CONFIG = {
    LOG_PREFIX: '🤖 [AI Solver]',
    DEBOUNCE_TIME: 1500,
    ANSWER_DELAY_MIN: 2000,
    ANSWER_DELAY_MAX: 5000,
    NEXT_DELAY_MIN: 1000,
    NEXT_DELAY_MAX: 3000,
    TYPING_SPEED: 50, // ms per character
};

let isSolving = false;
let solvedQuestions = new Set<string>();
let solverObserver: MutationObserver | null = null;
let statusIndicator: HTMLDivElement | null = null;

function solverLog(...args: any[]) { console.log(SOLVER_CONFIG.LOG_PREFIX, ...args); }

// ======================== UI INDICATOR ========================

function updateStatusUI(state: 'idle' | 'thinking' | 'done' | 'error', text?: string) {
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'prolific-ai-status';
        Object.assign(statusIndicator.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            padding: '8px 12px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '999999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.3s ease',
            border: '1px solid #eee'
        });
        document.body.appendChild(statusIndicator);
    }

    const icons = {
        idle: '⏳',
        thinking: '🤖',
        done: '✅',
        error: '⚠️'
    };

    const colors = {
        idle: '#6b7280',
        thinking: '#8b5cf6',
        done: '#10b981',
        error: '#ef4444'
    };

    statusIndicator.style.color = colors[state];
    statusIndicator.style.borderColor = colors[state];
    statusIndicator.innerHTML = `<span>${icons[state]}</span> <span>${text || state.toUpperCase()}</span>`;
    
    if (state === 'thinking') {
        statusIndicator.style.transform = 'scale(1.05)';
    } else {
        statusIndicator.style.transform = 'scale(1)';
    }
}

// ======================== EXTRACTION ========================

function getQuestionId(): string {
    return window.location.href + '#' + (document.querySelector('.QuestionText, .question-text, legend')?.textContent?.substring(0, 50) || Date.now());
}

function extractQuestionAndOptions(): { question: string, options: string[], type: 'choice' | 'text' } | null {
    const questionEl = document.querySelector('fieldset > legend, .QuestionText, .question-text, .q-text, h1, h2');
    if (!questionEl) return null;

    const question = questionEl.textContent?.trim() || '';
    if (!question || question.length < 5) return null;

    // Check for choice inputs (radio/checkbox)
    const options: string[] = [];
    const choiceInputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    
    choiceInputs.forEach(input => {
        const label = input.closest('label') || input.parentElement;
        const text = label?.textContent?.trim();
        if (text && text.length > 0) options.push(text);
    });

    if (options.length >= 2) {
        return { question, options, type: 'choice' };
    }

    // Check for text inputs (Textarea or Text input)
    const textInput = document.querySelector('textarea, input[type="text"]');
    if (textInput && (textInput as HTMLElement).offsetParent !== null) {
        return { question, options: [], type: 'text' };
    }

    return null;
}

// ======================== SOLVING ========================

async function solveCurrentQuestion() {
    if (isSolving) return;
    
    const qId = getQuestionId();
    if (solvedQuestions.has(qId)) return;

    const extracted = extractQuestionAndOptions();
    if (!extracted) return;

    isSolving = true;
    updateStatusUI('thinking', 'AI Thinking...');

    const systemPrompt = extracted.type === 'choice' 
        ? `You are a helpful assistant answering a survey. 
CRITICAL RULES:
1. If the question asks you to select a specific option to prove you are paying attention (e.g., "Select 'Sometimes'", "Choose 'Apple'"), YOU MUST follow that instruction exactly.
2. If there are no attention traps, answer logically and honestly.
3. Return ONLY the exact text of the correct option from the provided list, nothing else.`
        : `You are a helpful assistant answering a survey. 
CRITICAL RULES:
1. If the question asks you to type a specific word or phrase to prove you are paying attention (e.g., "Type the word 'Blue'", "Write 'I am human'"), YOU MUST write that exactly.
2. If it's a general question, answer logically and concisely (1-2 sentences).
3. Return ONLY the answer text.`;

    const userPrompt = extracted.type === 'choice'
        ? `Question: ${extracted.question}\nOptions:\n${extracted.options.map((o, i) => `${i+1}. ${o}`).join('\n')}`
        : `Question: ${extracted.question}\nThis is an open-ended text question. Please provide the appropriate answer.`;

    try {
        const response = await chrome.runtime.sendMessage({
            target: 'background',
            type: 'solve-question',
            data: { systemPrompt, userPrompt }
        });

        if (response && response.answer && response.answer !== 'NO_API_KEY') {
            solverLog('🎯 AI Answer:', response.answer);
            
            if (response.shadowMode) {
                solverLog('👤 [Shadow Mode] Skipping click. Planned answer:', response.answer);
                updateStatusUI('done', 'SHADOW MODE: ' + response.answer);
                solvedQuestions.add(qId);
                isSolving = false;
                return;
            }

            const success = await injectAnswer(response.answer, extracted.type);
            if (success) {
                updateStatusUI('done', 'Solved!');
                solvedQuestions.add(qId);
            } else {
                updateStatusUI('error', 'Could not inject');
                isSolving = false;
            }
        } else {
            updateStatusUI('error', response?.answer === 'NO_API_KEY' ? 'API Key Missing' : 'API Error');
            isSolving = false;
        }
    } catch (e) {
        solverLog('❌ Error:', e);
        updateStatusUI('error', 'Network Error');
        isSolving = false;
    }
}

async function injectAnswer(aiAnswer: string, type: 'choice' | 'text'): Promise<boolean> {
    const answerDelay = SOLVER_CONFIG.ANSWER_DELAY_MIN + Math.random() * (SOLVER_CONFIG.ANSWER_DELAY_MAX - SOLVER_CONFIG.ANSWER_DELAY_MIN);
    
    if (type === 'choice') {
        const targetInput = findChoiceElement(aiAnswer);
        if (targetInput) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    targetInput.click();
                    const nextDelay = SOLVER_CONFIG.NEXT_DELAY_MIN + Math.random() * (SOLVER_CONFIG.NEXT_DELAY_MAX - SOLVER_CONFIG.NEXT_DELAY_MIN);
                    setTimeout(() => { clickNextButton(); resolve(true); }, nextDelay);
                }, answerDelay);
            });
        }
    } else {
        const textInput = document.querySelector('textarea, input[type="text"]') as HTMLTextAreaElement | HTMLInputElement;
        if (textInput) {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    await simulateTyping(textInput, aiAnswer);
                    const nextDelay = SOLVER_CONFIG.NEXT_DELAY_MIN + Math.random() * (SOLVER_CONFIG.NEXT_DELAY_MAX - SOLVER_CONFIG.NEXT_DELAY_MIN);
                    setTimeout(() => { clickNextButton(); resolve(true); }, nextDelay);
                }, answerDelay);
            });
        }
    }
    return false;
}

function findChoiceElement(aiAnswer: string): HTMLElement | null {
    const answerLower = aiAnswer.toLowerCase().trim();
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const input of Array.from(inputs)) {
        const label = input.closest('label') || input.parentElement;
        const text = label?.textContent?.trim().toLowerCase() || '';
        if (text === answerLower || text.includes(answerLower)) return input as HTMLElement;
    }
    const buttons = document.querySelectorAll('button, label, .choice-label');
    for (const btn of Array.from(buttons)) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (text === answerLower || text.includes(answerLower)) return btn as HTMLElement;
    }
    return null;
}

async function simulateTyping(el: HTMLTextAreaElement | HTMLInputElement, text: string) {
    el.focus();
    el.value = '';
    for (const char of text) {
        el.value += char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, SOLVER_CONFIG.TYPING_SPEED + Math.random() * 20));
    }
    el.blur();
}

function clickNextButton() {
    const nextButton = document.querySelector('#NextButton, input[type="submit"], button[name="Next"], button.NextButton, .next-button');
    if (nextButton && (nextButton as HTMLElement).offsetParent !== null) {
        (nextButton as HTMLElement).click();
    }
    setTimeout(() => { isSolving = false; }, 2000);
}

function setupSolverObserver() {
    if (solverObserver) solverObserver.disconnect();
    solverObserver = new MutationObserver(() => {
        setTimeout(solveCurrentQuestion, SOLVER_CONFIG.DEBOUNCE_TIME);
    });
    solverObserver.observe(document.body, { childList: true, subtree: true });
}

// Start
if (window.location.href.includes('PROLIFIC_PID=')) {
    updateStatusUI('idle', 'Ready');
    setTimeout(() => {
        solveCurrentQuestion();
        setupSolverObserver();
    }, 2500);
}
