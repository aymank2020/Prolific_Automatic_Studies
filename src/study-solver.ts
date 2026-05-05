/**
 * Prolific Study Solver - AI-Assisted Survey Answering
 * Runs on external study sites to identify questions and provide AI-generated answers.
 */

const SOLVER_CONFIG = {
    LOG_PREFIX: '🤖 [Prolific Solver]',
    SCAN_INTERVAL: 3000,
    HUMAN_DELAY_MIN: 2000,
    HUMAN_DELAY_MAX: 5000,
    NEXT_DELAY_MIN: 1000,
    NEXT_DELAY_MAX: 3000,
};

function solverLog(...args: any[]) {
    console.log(SOLVER_CONFIG.LOG_PREFIX, ...args);
}

// ======================== EXTRACTION ========================

interface ExtractedQuestion {
    question: string;
    options: string[];
    container: HTMLElement;
}

/**
 * Attempt to extract the main question and its options from the current view
 */
function extractQuestionAndOptions(): ExtractedQuestion | null {
    // 1. Find common question containers (Qualtrics, Gorilla, etc.)
    const questionContainers = document.querySelectorAll('.QuestionOuter, .question-container, fieldset, .QuestionBody');
    
    for (const container of Array.from(questionContainers)) {
        const hContainer = container as HTMLElement;
        
        // Skip already solved or hidden containers
        if (hContainer.dataset.aiSolved === 'true' || hContainer.offsetParent === null) continue;

        // Try to find the question text
        const questionEl = hContainer.querySelector('.QuestionText, legend, label, .question-text, .q-text');
        if (!questionEl) continue;

        const question = questionEl.textContent?.trim() || '';
        if (question.length < 5) continue;

        // Try to find options (radio buttons, checkboxes, buttons)
        const optionEls = hContainer.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], .ChoiceStructure label, .choice-label');
        
        const options: string[] = [];
        const seenTexts = new Set<string>();

        optionEls.forEach(el => {
            const label = el.closest('label') || el.parentElement;
            const text = label?.textContent?.trim() || '';
            if (text && !seenTexts.has(text)) {
                options.push(text);
                seenTexts.add(text);
            }
        });

        if (options.length >= 2) {
            return { question, options, container: hContainer };
        }
    }

    // Fallback: If no container found, try looking for any visible text that looks like a question
    return null;
}

// ======================== SOLVING ========================

async function solveCurrentQuestion() {
    const extracted = extractQuestionAndOptions();
    if (!extracted) return;

    extracted.container.dataset.aiSolved = 'true';
    solverLog(`🧐 Question detected: "${extracted.question}"`);
    solverLog(`📋 Options: ${extracted.options.join(' | ')}`);

    const systemPrompt = `You are a helpful assistant answering a survey. 
    CRITICAL RULES:
    1. If the question asks you to select a specific option to prove you are paying attention (e.g., "Select 'Sometimes'", "Choose 'Neither agree nor disagree'", "Type 'Apple'"), YOU MUST follow that instruction exactly.
    2. If there are no attention traps, answer logically and honestly based on common sense.
    3. Return ONLY the exact text of the correct option from the provided list. Do not add punctuation or explanation.`;

    const userPrompt = `Question: ${extracted.question}\nOptions:\n${extracted.options.map((o, i) => `${i+1}. ${o}`).join('\n')}`;

    try {
        const answer = await solverNotifyBg('solve-question', { systemPrompt, userPrompt });
        
        if (answer && answer !== 'NO_API_KEY') {
            solverLog(`🎯 AI suggested answer: "${answer}"`);
            await injectAnswerWithHumanDelay(answer, extracted.options, extracted.container);
        } else if (answer === 'NO_API_KEY') {
            solverLog('⚠️ AI API Key not set in settings.');
        }
    } catch (error) {
        solverLog('❌ Error solving question:', error);
    }
}

async function injectAnswerWithHumanDelay(aiAnswer: string, options: string[], container: HTMLElement) {
    // Find the element to click
    const clickableEls = container.querySelectorAll('label, [role="radio"], [role="checkbox"], button, input[type="button"]');
    let targetEl: HTMLElement | null = null;

    for (const el of Array.from(clickableEls)) {
        const hEl = el as HTMLElement;
        if (hEl.textContent?.trim().toLowerCase() === aiAnswer.toLowerCase() || 
            hEl.textContent?.trim().includes(aiAnswer)) {
            targetEl = hEl;
            break;
        }
    }

    if (targetEl) {
        const delay = SOLVER_CONFIG.HUMAN_DELAY_MIN + Math.random() * (SOLVER_CONFIG.HUMAN_DELAY_MAX - SOLVER_CONFIG.HUMAN_DELAY_MIN);
        solverLog(`⏳ Waiting ${Math.round(delay)}ms to simulate human thinking...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        solverLog('🖱️ Clicking answer...');
        targetEl.click();

        // Optional: Auto-click "Next" if found
        const nextDelay = SOLVER_CONFIG.NEXT_DELAY_MIN + Math.random() * (SOLVER_CONFIG.NEXT_DELAY_MAX - SOLVER_CONFIG.NEXT_DELAY_MIN);
        await new Promise(resolve => setTimeout(resolve, nextDelay));

        const nextButton = document.querySelector('input[type="submit"], #NextButton, .NextButton, button[title*="Next"], button:contains("Next"), button:contains("Continue")') as HTMLElement;
        if (nextButton && nextButton.offsetParent !== null) {
            solverLog('➡️ Clicking "Next" button...');
            nextButton.click();
        }
    } else {
        solverLog(`❌ Could not find clickable element for answer: "${aiAnswer}"`);
    }
}

// ======================== UTILS ========================

function solverNotifyBg(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            target: 'background',
            type: type,
            data: data,
        }, response => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

// ======================== INITIALIZATION ========================

function startSolver() {
    solverLog('🚀 AI Solver activated.');
    
    // Periodically scan for new questions
    setInterval(solveCurrentQuestion, SOLVER_CONFIG.SCAN_INTERVAL);
    
    // Also solve immediately
    solveCurrentQuestion();
}

// Start only if we have the Prolific PID (meaning we are in a study)
if (window.location.href.includes('PROLIFIC_PID=')) {
    startSolver();
}
