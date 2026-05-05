/**
 * Prolific Study Solver - AI-Assisted Survey Answering
 */
// @ts-ignore: Isolated scope

const SOLVER_CONFIG = {
    LOG_PREFIX: '🤖 [AI Solver]',
    DEBOUNCE_TIME: 1500,
    ANSWER_DELAY_MIN: 2000,
    ANSWER_DELAY_MAX: 5000,
    NEXT_DELAY_MIN: 1000,
    NEXT_DELAY_MAX: 3000,
};

let isSolving = false;
let solvedQuestions = new Set<string>();
let solverObserver: MutationObserver | null = null;

function solverLog(...args: any[]) { console.log(SOLVER_CONFIG.LOG_PREFIX, ...args); }

function getQuestionId(): string {
    // Generate a semi-unique ID for the current question view
    return window.location.href + '#' + (document.querySelector('.QuestionText, .question-text, legend')?.textContent?.substring(0, 50) || Date.now());
}

function extractQuestionAndOptions(): { question: string, options: string[] } | null {
    // Robust extraction to prevent mixing question and options
    const questionEl = document.querySelector('fieldset > legend, .QuestionText, .question-text, .q-text, h1, h2');
    if (!questionEl) return null;

    const question = questionEl.textContent?.trim() || '';
    if (!question || question.length < 5) return null;

    const options: string[] = [];
    // Target inputs to find their associated labels
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    
    inputs.forEach(input => {
        const label = input.closest('label') || input.parentElement;
        const text = label?.textContent?.trim();
        if (text && text.length > 0) {
            options.push(text);
        }
    });

    // If no radio/checkbox found, check for button-style choices (Gorilla/Typeform)
    if (options.length === 0) {
        const buttons = document.querySelectorAll('button.choice, .ChoiceStructure label, .choice-label');
        buttons.forEach(btn => {
            const text = btn.textContent?.trim();
            if (text) options.push(text);
        });
    }

    return options.length >= 2 ? { question, options } : null;
}

async function solveCurrentQuestion() {
    if (isSolving) return;
    
    const qId = getQuestionId();
    if (solvedQuestions.has(qId)) return;

    const extracted = extractQuestionAndOptions();
    if (!extracted || extracted.options.length === 0) return;

    isSolving = true;
    
    solverLog('🧐 Question detected:', extracted.question);
    solverLog('📋 Options:', extracted.options.join(' | '));

    const systemPrompt = `You are a helpful assistant answering a survey. 
CRITICAL RULES:
1. If the question asks you to select a specific option to prove you are paying attention (e.g., "Select 'Sometimes'", "Choose 'Apple'"), YOU MUST follow that instruction exactly.
2. If there are no attention traps, answer logically and honestly based on the provided context.
3. Return ONLY the exact text of the correct option from the provided list, nothing else.`;

    const userPrompt = `Question: ${extracted.question}\nOptions:\n${extracted.options.map((o, i) => `${i+1}. ${o}`).join('\n')}`;

    try {
        const aiAnswer = await chrome.runtime.sendMessage({
            target: 'background',
            type: 'solve-question',
            data: { systemPrompt, userPrompt }
        });

        if (aiAnswer && aiAnswer !== 'NO_API_KEY') {
            solverLog('🎯 AI Answer:', aiAnswer);
            const success = await injectAnswer(aiAnswer, extracted.options);
            if (success) {
                solvedQuestions.add(qId);
            } else {
                isSolving = false;
            }
        } else {
            if (aiAnswer === 'NO_API_KEY') solverLog('⚠️ API Key missing.');
            isSolving = false;
        }
    } catch (e) {
        solverLog('❌ Communication error:', e);
        isSolving = false;
    }
}

async function injectAnswer(aiAnswer: string, options: string[]): Promise<boolean> {
    const answerLower = aiAnswer.toLowerCase().trim();
    let targetInput: HTMLElement | null = null;

    // Search for inputs first
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const input of Array.from(inputs)) {
        const label = input.closest('label') || input.parentElement;
        const labelText = label?.textContent?.trim().toLowerCase() || '';
        
        if (labelText === answerLower || labelText.includes(answerLower)) {
            targetInput = input as HTMLElement;
            break;
        }
    }

    // Fallback to buttons/labels
    if (!targetInput) {
        const interactables = document.querySelectorAll('label, button, .choice-label');
        for (const el of Array.from(interactables)) {
            const text = el.textContent?.trim().toLowerCase() || '';
            if (text === answerLower || text.includes(answerLower)) {
                targetInput = el as HTMLElement;
                break;
            }
        }
    }

    if (targetInput) {
        const answerDelay = SOLVER_CONFIG.ANSWER_DELAY_MIN + Math.random() * (SOLVER_CONFIG.ANSWER_DELAY_MAX - SOLVER_CONFIG.ANSWER_DELAY_MIN);
        solverLog(`⏳ Waiting ${Math.round(answerDelay)}ms (Human Delay)...`);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                targetInput?.click();
                solverLog('🖱️ Answer clicked.');

                const nextDelay = SOLVER_CONFIG.NEXT_DELAY_MIN + Math.random() * (SOLVER_CONFIG.NEXT_DELAY_MAX - SOLVER_CONFIG.NEXT_DELAY_MIN);
                setTimeout(() => {
                    clickNextButton();
                    resolve(true);
                }, nextDelay);
                
            }, answerDelay);
        });
    } else {
        solverLog('❌ Matching element not found.');
        return false;
    }
}

function clickNextButton() {
    // Uses only valid CSS selectors as noted in review
    const nextButton = document.querySelector('#NextButton, input[type="submit"], button[name="Next"], button.NextButton, .next-button');
    if (nextButton && (nextButton as HTMLElement).offsetParent !== null) {
        (nextButton as HTMLElement).click();
        solverLog('➡️ Next clicked.');
    }
    // Release lock after a short buffer
    setTimeout(() => { isSolving = false; }, 2000);
}

function setupSolverObserver() {
    if (solverObserver) solverObserver.disconnect();
    
    let debounce: any = null;
    solverObserver = new MutationObserver(() => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
            solveCurrentQuestion();
        }, SOLVER_CONFIG.DEBOUNCE_TIME);
    });

    solverObserver.observe(document.body, { childList: true, subtree: true });
    solverLog('👁️ MutationObserver active.');
}

// Start Solver
if (window.location.href.includes('PROLIFIC_PID=')) {
    solverLog('🚀 Study page detected. Ready.');
    // Initial delay for page load
    setTimeout(() => {
        solveCurrentQuestion();
        setupSolverObserver();
    }, 2500);
}
