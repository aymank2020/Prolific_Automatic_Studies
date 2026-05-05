"use strict";
/**
 * Prolific Study Solver - AI-Assisted Survey Answering
 */
// @ts-ignore: Isolated scope
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const SOLVER_CONFIG = {
    LOG_PREFIX: '🤖 [AI Solver]',
    DEBOUNCE_TIME: 1500,
    ANSWER_DELAY_MIN: 2000,
    ANSWER_DELAY_MAX: 5000,
    NEXT_DELAY_MIN: 1000,
    NEXT_DELAY_MAX: 3000,
};
let isSolving = false;
let solvedQuestions = new Set();
let solverObserver = null;
function solverLog(...args) { console.log(SOLVER_CONFIG.LOG_PREFIX, ...args); }
function getQuestionId() {
    var _a, _b;
    // Generate a semi-unique ID for the current question view
    return window.location.href + '#' + (((_b = (_a = document.querySelector('.QuestionText, .question-text, legend')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.substring(0, 50)) || Date.now());
}
function extractQuestionAndOptions() {
    var _a;
    // Robust extraction to prevent mixing question and options
    const questionEl = document.querySelector('fieldset > legend, .QuestionText, .question-text, .q-text, h1, h2');
    if (!questionEl)
        return null;
    const question = ((_a = questionEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
    if (!question || question.length < 5)
        return null;
    const options = [];
    // Target inputs to find their associated labels
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
        var _a;
        const label = input.closest('label') || input.parentElement;
        const text = (_a = label === null || label === void 0 ? void 0 : label.textContent) === null || _a === void 0 ? void 0 : _a.trim();
        if (text && text.length > 0) {
            options.push(text);
        }
    });
    // If no radio/checkbox found, check for button-style choices (Gorilla/Typeform)
    if (options.length === 0) {
        const buttons = document.querySelectorAll('button.choice, .ChoiceStructure label, .choice-label');
        buttons.forEach(btn => {
            var _a;
            const text = (_a = btn.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (text)
                options.push(text);
        });
    }
    return options.length >= 2 ? { question, options } : null;
}
function solveCurrentQuestion() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isSolving)
            return;
        const qId = getQuestionId();
        if (solvedQuestions.has(qId))
            return;
        const extracted = extractQuestionAndOptions();
        if (!extracted || extracted.options.length === 0)
            return;
        isSolving = true;
        solverLog('🧐 Question detected:', extracted.question);
        solverLog('📋 Options:', extracted.options.join(' | '));
        const systemPrompt = `You are a helpful assistant answering a survey. 
CRITICAL RULES:
1. If the question asks you to select a specific option to prove you are paying attention (e.g., "Select 'Sometimes'", "Choose 'Apple'"), YOU MUST follow that instruction exactly.
2. If there are no attention traps, answer logically and honestly based on the provided context.
3. Return ONLY the exact text of the correct option from the provided list, nothing else.`;
        const userPrompt = `Question: ${extracted.question}\nOptions:\n${extracted.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
        try {
            const aiAnswer = yield chrome.runtime.sendMessage({
                target: 'background',
                type: 'solve-question',
                data: { systemPrompt, userPrompt }
            });
            if (aiAnswer && aiAnswer !== 'NO_API_KEY') {
                solverLog('🎯 AI Answer:', aiAnswer);
                const success = yield injectAnswer(aiAnswer, extracted.options);
                if (success) {
                    solvedQuestions.add(qId);
                }
                else {
                    isSolving = false;
                }
            }
            else {
                if (aiAnswer === 'NO_API_KEY')
                    solverLog('⚠️ API Key missing.');
                isSolving = false;
            }
        }
        catch (e) {
            solverLog('❌ Communication error:', e);
            isSolving = false;
        }
    });
}
function injectAnswer(aiAnswer, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const answerLower = aiAnswer.toLowerCase().trim();
        let targetInput = null;
        // Search for inputs first
        const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        for (const input of Array.from(inputs)) {
            const label = input.closest('label') || input.parentElement;
            const labelText = ((_a = label === null || label === void 0 ? void 0 : label.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) || '';
            if (labelText === answerLower || labelText.includes(answerLower)) {
                targetInput = input;
                break;
            }
        }
        // Fallback to buttons/labels
        if (!targetInput) {
            const interactables = document.querySelectorAll('label, button, .choice-label');
            for (const el of Array.from(interactables)) {
                const text = ((_b = el.textContent) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase()) || '';
                if (text === answerLower || text.includes(answerLower)) {
                    targetInput = el;
                    break;
                }
            }
        }
        if (targetInput) {
            const answerDelay = SOLVER_CONFIG.ANSWER_DELAY_MIN + Math.random() * (SOLVER_CONFIG.ANSWER_DELAY_MAX - SOLVER_CONFIG.ANSWER_DELAY_MIN);
            solverLog(`⏳ Waiting ${Math.round(answerDelay)}ms (Human Delay)...`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    targetInput === null || targetInput === void 0 ? void 0 : targetInput.click();
                    solverLog('🖱️ Answer clicked.');
                    const nextDelay = SOLVER_CONFIG.NEXT_DELAY_MIN + Math.random() * (SOLVER_CONFIG.NEXT_DELAY_MAX - SOLVER_CONFIG.NEXT_DELAY_MIN);
                    setTimeout(() => {
                        clickNextButton();
                        resolve(true);
                    }, nextDelay);
                }, answerDelay);
            });
        }
        else {
            solverLog('❌ Matching element not found.');
            return false;
        }
    });
}
function clickNextButton() {
    // Uses only valid CSS selectors as noted in review
    const nextButton = document.querySelector('#NextButton, input[type="submit"], button[name="Next"], button.NextButton, .next-button');
    if (nextButton && nextButton.offsetParent !== null) {
        nextButton.click();
        solverLog('➡️ Next clicked.');
    }
    // Release lock after a short buffer
    setTimeout(() => { isSolving = false; }, 2000);
}
function setupSolverObserver() {
    if (solverObserver)
        solverObserver.disconnect();
    let debounce = null;
    solverObserver = new MutationObserver(() => {
        if (debounce)
            clearTimeout(debounce);
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
